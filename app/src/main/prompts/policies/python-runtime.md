## Python 실행 규약
- Python 코드 실행: `uv run python <스크립트>` 또는 `uv run python -c "..."` 형태를 사용한다.
- 패키지 설치: `uv pip install <패키지>` 를 사용한다.
- 시스템 `python` / `pip` 직접 호출 금지 — 앱이 주입한 격리 환경에서만 동작한다.
