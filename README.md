# Rita-Berenice v2

[English](README.en.md)

> **Archived portfolio snapshot**
>
> 이 저장소는 Rita-Berenice의 개발 과정과 기술적 설계를 보존하기 위한 **이력서/포트폴리오용 공개 스냅샷**입니다.
> 더 이상 일반 사용자용 배포 저장소로 관리하지 않으며, 설치·운영·업데이트·기능 지원을 제공하지 않습니다.

Rita-Berenice는 개인적으로 사용하기 위해 개발한 self-hosted AI 캐릭터챗 프레임워크입니다. 사용자가 자신의 캐릭터와 대화 데이터를 직접 보관하고, 원하는 LLM 공급자를 연결하며, 장기간의 대화 맥락과 기억을 자신의 데이터베이스에서 관리하는 것을 목표로 개발되었습니다.

이 저장소의 코드는 당시 구현과 아키텍처를 공개적으로 기록하기 위해 남겨 둡니다. **새로운 설치나 실제 사용을 위해 이 저장소를 사용하지 마세요.** 향후 일반 사용자를 위한 공개 버전은 이 저장소와 분리된 별도의 프로젝트와 릴리즈 채널에서 제공할 예정입니다.

## Repository status

- **Status:** Frozen / portfolio archive
- **Development:** 이 저장소에서는 진행하지 않음
- **Releases:** 이 저장소에서는 제공하지 않음
- **Support / maintenance:** 제공하지 않음
- **Feature requests / Pull Requests:** 받지 않음
- **Demo availability:** 보장하지 않음

이 저장소는 향후 공개 릴리즈 프로젝트의 source of truth가 아닙니다.

## About the project

당시 Rita-Berenice는 다음과 같은 방향으로 개발되었습니다.

- 사용자가 소유하는 캐릭터·프로필·대화 데이터
- BYOK 기반의 여러 LLM provider 연결
- PostgreSQL/pgvector 기반 영속 저장
- 장기 대화에서 과거 사건과 맥락을 다시 사용할 수 있는 기억 계층
- 캐릭터 설정, lore, history, recap, 대화 기록의 분리 관리
- 사용자가 직접 설치하고 코드를 수정할 수 있는 self-hosted 구조

세부 구현은 이 저장소의 소스 코드와 Git history에 기록되어 있습니다.

## License

이 저장소에 포함된 기존 라이선스는 이 스냅샷에 적용됩니다. 다만 이 저장소는 더 이상 배포 또는 사용을 권장하는 채널이 아니며, 향후 별도 공개 프로젝트의 라이선스와 배포 정책은 독립적으로 결정됩니다.
