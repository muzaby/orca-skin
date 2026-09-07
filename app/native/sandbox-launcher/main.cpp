#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
constexpr uint32_t kMaxPayload = 1024 * 1024;
constexpr uint32_t kMaxCount = 4096;
struct Failure { const char* code; DWORD error = 0; };
void require(bool condition, const char* code) { if (!condition) throw Failure{code}; }
void winCheck(bool condition, const char* code) { if (!condition) throw Failure{code, GetLastError()}; }

// Read exactly the requested bytes: reading ahead would steal the target's SDK input.
void readExact(HANDLE input, void* destination, DWORD size) {
  auto* bytes = static_cast<unsigned char*>(destination);
  while (size) {
    DWORD read = 0;
    winCheck(ReadFile(input, bytes, size, &read, nullptr) != FALSE, "READ_FAILED");
    require(read != 0, "TRUNCATED_FRAME");
    bytes += read;
    size -= read;
  }
}
uint32_t little(const unsigned char* b) {
  return uint32_t(b[0]) | uint32_t(b[1]) << 8 | uint32_t(b[2]) << 16 | uint32_t(b[3]) << 24;
}
struct Reader {
  const std::vector<unsigned char>& bytes;
  size_t position = 0;
  uint32_t number() {
    require(bytes.size() - position >= 4, "TRUNCATED_FIELD");
    const auto result = little(bytes.data() + position);
    position += 4;
    return result;
  }
  uint32_t count() { const auto value = number(); require(value <= kMaxCount, "EXCESSIVE_COUNT"); return value; }
  std::wstring string() {
    const auto size = number();
    require(size <= bytes.size() - position, "TRUNCATED_STRING");
    const auto* start = reinterpret_cast<const char*>(bytes.data() + position);
    position += size;
    if (!size) return {};
    require(std::find(start, start + size, '\0') == start + size, "NUL_STRING");
    const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, start, static_cast<int>(size), nullptr, 0);
    require(length > 0, "INVALID_UTF8");
    std::wstring result(length, L'\0');
    winCheck(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, start, static_cast<int>(size), result.data(), length) != 0, "INVALID_UTF8");
    return result;
  }
};
struct CaseLess {
  bool operator()(const std::wstring& a, const std::wstring& b) const {
    const int compared = CompareStringOrdinal(a.c_str(), static_cast<int>(a.size()), b.c_str(), static_cast<int>(b.size()), TRUE);
    winCheck(compared != 0, "ENV_COMPARE_FAILED");
    return compared == CSTR_LESS_THAN;
  }
};
bool equal(const std::wstring& a, const std::wstring& b) { return !CaseLess{}(a,b) && !CaseLess{}(b,a); }
bool prefix(const std::wstring& value, const std::wstring& start) { return value.size() >= start.size() && equal(value.substr(0, start.size()), start); }
bool reserved(const std::wstring& key) {
  const wchar_t* names[] = { L"SYSTEMROOT", L"WINDIR", L"USERPROFILE", L"HOMEDRIVE", L"HOMEPATH", L"HOME",
    L"APPDATA", L"LOCALAPPDATA", L"PROGRAMDATA", L"TEMP", L"TMP", L"HTTP_PROXY", L"HTTPS_PROXY", L"ALL_PROXY", L"NO_PROXY",
    L"SSL_CERT_FILE", L"SSL_CERT_DIR", L"NODE_EXTRA_CA_CERTS", L"REQUESTS_CA_BUNDLE", L"CURL_CA_BUNDLE",
    L"GIT_SSL_CAINFO", L"GIT_SSL_CAPATH", L"GIT_PROXY_COMMAND" };
  for (const auto* name : names) if (equal(key, name)) return true;
  return prefix(key, L"GIT_CONFIG") || prefix(key, L"SRT_");
}
bool slash(wchar_t c) { return c == L'\\' || c == L'/'; }
bool absolute(const std::wstring& path) {
  if (path.size() >= 3 && ((path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z')) && path[1] == L':' && slash(path[2])) return true;
  if (path.size() < 5 || path[0] != L'\\' || path[1] != L'\\' || path[2] == L'.' || path[2] == L'?') return false;
  const auto serverEnd = path.find_first_of(L"\\/", 2);
  return serverEnd != std::wstring::npos && serverEnd > 2 && serverEnd + 1 < path.size() && !slash(path[serverEnd + 1]);
}
// Standard Windows CRT argv quoting; lpApplicationName separately fixes the executable.
std::wstring quote(const std::wstring& arg) {
  std::wstring result = L"\"";
  size_t backslashes = 0;
  for (const auto c : arg) {
    if (c == L'\\') { ++backslashes; continue; }
    result.append(backslashes * (c == L'"' ? 2 : 1), L'\\');
    if (c == L'"') result += L'\\';
    result += c;
    backslashes = 0;
  }
  result.append(backslashes * 2, L'\\');
  result += L'"';
  return result;
}
struct Handle {
  HANDLE value = nullptr;
  ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
};
struct Attributes {
  std::vector<unsigned char> storage;
  LPPROC_THREAD_ATTRIBUTE_LIST value = nullptr;
  ~Attributes() { if (value) DeleteProcThreadAttributeList(value); }
};
DWORD launch() {
  unsigned char header[12];
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  readExact(input, header, sizeof(header));
  require(header[0] == 'O' && header[1] == 'R' && header[2] == 'C' && header[3] == 'A', "INVALID_MAGIC");
  require(little(header + 4) == 1, "UNSUPPORTED_VERSION");
  const auto length = little(header + 8);
  require(length <= kMaxPayload, "FRAME_TOO_LARGE");
  std::vector<unsigned char> payload(length);
  readExact(input, payload.data(), length);
  Reader reader{payload};
  const auto executable = reader.string();
  const auto cwd = reader.string();
  require(absolute(executable) && executable.size() >= 4 && equal(executable.substr(executable.size()-4), L".exe"), "INVALID_EXECUTABLE");
  require(absolute(cwd), "INVALID_CWD");
  std::wstring command = quote(executable);
  const auto argc = reader.count();
  for (uint32_t i = 0; i < argc; ++i) command += L" " + quote(reader.string());
  require(command.size() < 32767, "COMMAND_TOO_LONG");
  std::map<std::wstring, std::wstring, CaseLess> environment;
  auto* inherited = GetEnvironmentStringsW();
  winCheck(inherited != nullptr, "ENV_READ_FAILED");
  try {
    for (const auto* entry = inherited; *entry; entry += wcslen(entry) + 1) {
      std::wstring text(entry);
      const auto split = text.find(L'=', text[0] == L'=' ? 1 : 0);
      if (split != std::wstring::npos) environment[text.substr(0, split)] = text.substr(split + 1);
    }
  } catch (...) { FreeEnvironmentStringsW(inherited); throw; }
  FreeEnvironmentStringsW(inherited);
  const auto envc = reader.count();
  std::set<std::wstring, CaseLess> overlay;
  for (uint32_t i = 0; i < envc; ++i) {
    const auto key = reader.string();
    const auto value = reader.string();
    require(!key.empty() && key.find(L'=') == std::wstring::npos && !reserved(key), "INVALID_ENV_KEY");
    require(overlay.insert(key).second, "DUPLICATE_ENV_KEY");
    environment[key] = value;
  }
  require(reader.position == payload.size(), "TRAILING_PAYLOAD");
  std::vector<wchar_t> block;
  for (const auto& entry : environment) {
    const auto text = entry.first + L"=" + entry.second;
    block.insert(block.end(), text.begin(), text.end());
    block.push_back(L'\0');
  }
  if (block.empty()) block.push_back(L'\0');
  block.push_back(L'\0');
  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = input;
  startup.StartupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  startup.StartupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
  std::vector<HANDLE> handles;
  for (const HANDLE handle : { input, startup.StartupInfo.hStdOutput, startup.StartupInfo.hStdError }) {
    require(handle && handle != INVALID_HANDLE_VALUE, "INVALID_STD_HANDLE");
    winCheck(SetHandleInformation(handle, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) != FALSE, "STD_HANDLE_FAILED");
    if (std::find(handles.begin(), handles.end(), handle) == handles.end()) handles.push_back(handle);
  }
  Attributes attributes;
  SIZE_T bytes = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &bytes);
  require(bytes != 0, "ATTR_SIZE_FAILED");
  attributes.storage.resize(bytes);
  auto* list = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attributes.storage.data());
  winCheck(InitializeProcThreadAttributeList(list, 1, 0, &bytes) != FALSE, "ATTR_INIT_FAILED");
  attributes.value = list;
  winCheck(UpdateProcThreadAttribute(list, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, handles.data(), handles.size() * sizeof(HANDLE), nullptr, nullptr) != FALSE, "ATTR_HANDLES_FAILED");
  startup.lpAttributeList = list;
  PROCESS_INFORMATION process{};
  // The current token and enclosing job remain in force. No alternate logon or breakaway.
  winCheck(CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, TRUE,
    EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW,
    block.data(), cwd.c_str(), &startup.StartupInfo, &process) != FALSE, "CREATE_FAILED");
  Handle child{process.hProcess};
  Handle thread{process.hThread};
  winCheck(WaitForSingleObject(child.value, INFINITE) == WAIT_OBJECT_0, "WAIT_FAILED");
  DWORD result = 0;
  winCheck(GetExitCodeProcess(child.value, &result) != FALSE, "EXIT_FAILED");
  return result;
}
} // namespace

int wmain(int argc, wchar_t** argv) {
  try {
    require(argc == 2 && std::wstring(argv[1]) == L"orca-launch-v1", "INVALID_INVOCATION");
    const DWORD code = launch();
    ExitProcess(code);
  } catch (const Failure& failure) {
    if (failure.error) std::fprintf(stderr, "orca-launcher: %s %lu\n", failure.code, failure.error);
    else std::fprintf(stderr, "orca-launcher: %s\n", failure.code);
  } catch (...) { std::fprintf(stderr, "orca-launcher: INTERNAL_ERROR\n"); }
  return 125;
}
