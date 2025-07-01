# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-06-30

### Added

- 최초로 로컬 개발 환경에서 SSR + CSR 통합 실행 성공
- `vite`, `express`, `react`, `emotion`, `mui` 기반 SSR 렌더링 구성
- `tsconfig`, `vite.config.ts`, `server.ts`, `entry-server.tsx` 등 주요 구성 완료
- `import alias` 적용 및 경로 정리 (`#server/*`, `#client/*`, `#shared/*`)

### Changed

- `pnpm`을 도입하여 패키지 관리 방식을 `yarn` → `pnpm`으로 전환
- `tsc-alias`로 서버 빌드 후 alias 자동 치환 구조 설정

### Notes

- 아직 DB나 API 로직은 연결되지 않았음 (기본 틀만 구성 완료)
- ChromaDB, LangChain 등은 향후 통합 예정
