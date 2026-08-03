# `modules/__fixtures__/`

테스트 전용 정적 auth plugin package 예시다. production `AUTH_PLUGIN_PACKAGES`에는 등록하지 않으며, 테스트가 명시적으로 import해 opt-in한다.

- connector는 고정 descriptor(origin 포함)와 connector당 활성 연결 하나를 표현한다.
- URL, alias, endpoint, connection ID를 사용자 입력으로 받지 않는다.
- runtime tool contribution은 connector ID를 명시하고 read-only와 write 예시를 모두 포함한다.
- 서비스·부서 식별 리터럴은 이 디렉터리와 해당 테스트 밖 core 코드에 두지 않는다.
