# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-08-14

### Added

- Personal-use AI character and long-term-memory RAG framework release.
- Vite React 19 SSR/browser client, Express 5 SSR/API server, and shared contract package.
- PostgreSQL with `pgvector` as the active persistence and vector retrieval layer.
- SuperTokens-backed authentication and REST API hardening.

### Changed

- Repository restructured into a pnpm/Turbo TypeScript monorepo.
- Provider-specific LLM details kept behind `server/service/llmService.ts`.
- RAG memory recall, orchestration, persona generation, and persistence concerns separated.

## [1.0.0] - 2025-06-30

### Added

- 최초로 로컬 개발 환경에서 SSR + CSR 통합 실행 성공
- `vite`, `express`, `react`, `emotion`, `mui` 기반 SSR 렌더링 구성
- `tsconfig`, `vite.config.ts`, `server.ts`, `entry-server.tsx` 등 주요 구성 완료
- `import alias` 적용 및 경로 정리 (`#server/*`, `#client/*`, `@rita-berenice/shared/*`)
