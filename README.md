# Rita-Berenice v2

[English](README.en.md)

Rita-Berenice v2는 장기기억 RAG 계층을 갖춘 개인용 AI 캐릭터 프레임워크이며, pnpm/Turbo TypeScript
모노레포로 구성된다. Vite React 19 클라이언트, Express 5 SSR/API 서버, 공유 도메인 계약,
PostgreSQL/pgvector 영속 계층으로 이루어진다.

호스팅 제품도 멀티테넌트 서비스도 아니다. 모든 LLM 호출은 사용자가 제공하고 서버가 사용자별로
암호화해 보관하는 API 키로 실행되므로, 공급자 선택과 비용과 모델 선택은 배포 주체가 아니라 계정
소유자에게 남는다. 이 전제가 설계를 규정한다. 모델 접근은 요청마다 사용자 자격증명에서 해석되고,
검색 예산은 작고 명시적이며, 비용이 큰 작업(메타데이터 보강, 임베딩)은 응답 경로가 아니라 백그라운드
잡으로 미뤄진다.

- 승인되지 않은 생성 문서가 프롬프트에 도달할 수 없도록 DB 체크 제약으로 강제 — [기억 계층](#기억-계층)
- `groundingDecision`을 응답 스키마 필드로 요구하고, `contradicted` 판정 시 1회 수정 패스 — [LLM 호출과 구조화 출력](#llm-호출과-구조화-출력)
- 스트리밍 중 판정 미해결 구간을 버퍼링하고, 모순 판정 시 버퍼를 폐기한 뒤 수정본을 스트리밍 — [LLM 호출과 구조화 출력](#llm-호출과-구조화-출력)
- 임베딩과 턴 후처리를 응답 경로 밖 백그라운드 잡으로 분리 — [응답 후보와 사람의 선택](#응답-후보와-사람의-선택)
- 검색 실패 유형별 교정 3종: 키워드 폴백, critical-term 구제, 의도 기반 선택 — [검색과 우선순위](#검색과-우선순위)

## 데모

- 데모 배포: <https://rita-berenice-demo.fly.dev> — `main`에서
  [.github/workflows/fly-deploy-demo.yml](.github/workflows/fly-deploy-demo.yml)로 배포된다.
- 정적 클라이언트 빌드: `pnpm build:static`은 서버 없이 동작하는 클라이언트 번들을 생성하며, GitHub
  Pages 워크플로 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)가 이를 `mock`
  브랜치에서 배포한다.
- 대화 생성에는 사용자 본인의 공급자 API 키가 필요하며, 앱 내 키 입력 다이얼로그
  ([ApiKeyDialog.tsx](packages/client/page/chat/ApiKeyDialog.tsx))로 등록한다. 키 없이 로그인하면 UI와
  저장된 데이터에는 접근할 수 있지만 모델 출력은 얻을 수 없다.

## 아키텍처

### 기억 계층

기억은 하나의 미분화된 벡터 저장소가 아니라 수명과 편집 주체를 기준으로 나뉜다. 모든 계층의 스키마는
[schema.ts](packages/server/db/schema.ts)에 있다.

| 계층          | 테이블            | 범위와 수명                                                                                                                           | 기록 주체                                                                        |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 프로필        | `profiles`        | 세션당 하나(`session_id` 유니크 인덱스). 사용자의 극중 정체성                                                                         | 사용자, [profileStore.ts](packages/server/store/profileStore.ts)                 |
| 캐릭터        | `characters`      | 페르소나 기준선: 세계관 소개, 캐릭터 소개, 연기 지침                                                                                  | 사용자, [characterStore.ts](packages/server/store/characterStore.ts)             |
| 설정(lore)    | `lores`           | 기본은 캐릭터 범위. `LoreInfo.sessionId`가 설정되면 해당 세션에만 노출된다 ([lore.type.ts](packages/shared/domain/lore/lore.type.ts)) | 사용자, [loreStore.ts](packages/server/store/loreStore.ts)                       |
| 역사(history) | `histories`       | 캐릭터 단위 과거 사건. 그 캐릭터의 모든 세션이 공유한다                                                                               | 사용자, [historyStore.ts](packages/server/store/historyStore.ts)                 |
| 세계 내 문서  | `documents`       | 세션 범위. `draft` → `approved` → `archived`                                                                                          | 사용자 또는 LLM 생성, [documentStore.ts](packages/server/store/documentStore.ts) |
| 세션 기억     | `chat_turns`      | 확정된 턴당 한 행. 추가 전용이며 LLM 메타데이터로 보강된다                                                                            | [finalizationJobService.ts](packages/server/service/finalizationJobService.ts)   |
| 요약(recap)   | `recaps`          | `turn_start`–`turn_end` 구간 요약                                                                                                     | 클라이언트, [recap.routes.ts](packages/server/route/recap.routes.ts)             |
| 후보          | `temp_chat_turns` | `(session_id, sequence)` 키. 아직 확정되지 않은 현재 턴만 보관한다                                                                    | [orchestrationService.ts](packages/server/service/orchestrationService.ts)       |

이렇게 나누는 이유는 각 계층이 서로 다른 시계로 갱신되기 때문이다. 프로필과 캐릭터 설정은 의도적으로
편집되며 정의상 현재 상태다. 설정과 역사는 저작된 참조 자료다. 대화 턴은 자동으로 쌓이고 확정 후에는
수정되지 않는다. 요약은 대화 턴의 구간을 압축한다. 이들을 하나의 저장소로 합치면 "사용자가 설정한
것"과 "대화에서 일어난 것"이 코사인 거리만으로 경쟁하게 된다.

모든 계층의 임베딩은 `memory_embeddings` 한 테이블에 모이며 `source_type`
(`chat` | `lore` | `history` | `recap` | `document`)으로 구분되고, 1536차원 벡터에 HNSW 코사인 인덱스가
걸린다 — [embeddingService.ts](packages/server/service/embeddingService.ts). 쓰기는 콘텐츠 해시로
보호되는 `replaceMemoryEmbedding`을 거치며
[embeddingJobService.ts](packages/server/service/embeddingJobService.ts)의 큐로 처리되므로 재임베딩이
응답을 막지 않는다. 임베딩이 반영되기 전에 원본이 다시 편집되면 generation 카운터가 처리 중인 잡을
무효화한다.

검색 접근 통제는 애플리케이션 코드뿐 아니라 SQL에서도 걸린다. `documents`에는 체크 제약
(`documents_retrieval_requires_approval_check`)이 있어 `retrieval_enabled`는 `status = 'approved'`일
때만 허용되고, `queryApproved`는 두 컬럼 모두로 필터링한다. 생성된 문서는 사람이 승인하기 전에는
프롬프트에 도달할 수 없다.

### 검색과 우선순위

질의 변환 — [ragQueryService.ts](packages/server/service/ragQueryService.ts):

1. 세션 용어집 항목을 원문에 치환한다(`terms` 테이블, 한국어 → 영어).
2. 번역과 구조화된 필터 추출을 `Promise.allSettled`로 동시에 수행하므로 한쪽이 실패해도 턴 전체가
   실패하지 않는다. 번역은 치환된 텍스트로, 추출은 빈 조건으로 각각 폴백한다.
3. 추출된 topics, keywords, entities와 `criticalTerm`은 추가 LLM 호출 없이 확장 질의문으로 펼쳐진다.

검색 — [memoryEngine.ts](packages/server/service/memoryEngine.ts)는 대화 턴, 설정, 역사, 요약, 문서를
병렬로 조회하며 하나의 `QueryEmbeddingCache`를 공유한다. 따라서 질의문 하나는 소스마다가 아니라 턴당
한 번만 임베딩된다.

랭킹은 의미 거리와 최신성을 0.7 / 0.3 고정 가중치로 결합하고
([queryUtils.ts](packages/server/util/queryUtils.ts)), 이어서 세 가지 교정을 적용한다.

- **키워드 폴백.** `queryChatTurnsByKeywords` / `queryRecapsByKeywords`가 어휘 기반 조회를 수행해 벡터
  검색이 놓친 결과를 병합한다. 순수 임베딩 검색은 희귀 고유명사를 놓치는데, 장기간 이어지는 서사가
  의존하는 것이 바로 그 부류의 단어다.
- **critical-term 구제.** 모든 소스의 결과 합이 3건 미만이고 질의에 `criticalTerm`이 있으면, 그 용어
  하나만으로 필터 없는 2차 검색을 수행한다.
- **의도 기반 선택.** `hasEarliestEventIntent`는 "X가 처음 일어난 게 언제인가" 형태의 질의를 기본값인
  `selectHighConfidenceQueryMatches`(용어 적중이 많은 쪽) 대신
  `selectEarliestRelevantMatches`(sequence가 낮은 쪽)로 보낸다 —
  [ragKeywordUtils.ts](packages/server/util/ragKeywordUtils.ts).

선택된 대화 턴은 바로 뒤따르는 턴 최대 4개로 확장된다
([ragContinuityUtils.ts](packages/server/util/ragContinuityUtils.ts)). 검색된 턴은 대개 주고받음의
시작이고, 답은 질문이 아니라 응답 쪽에 있기 때문이다.

우선순위는 프롬프트 텍스트로 강제한다. 검색 순서만으로는 어떤 소스가 어떤 소스를 이기는지 모델에
전달되지 않기 때문이다. [templateUtils.ts](packages/server/util/templateUtils.ts)의 규칙은 다음과 같다.

- 설정과 역사는 "Official Lore (Absolute Truth)" / "Past Events (Absolute Truth)"로 라벨링되고,
  회상된 대화는 일반적인 과거 기억으로 라벨링된다.
- 세계 내 문서는 발행 주체의 주장으로 라벨링되며 `claimMode`
  (`record` / `statement` / `report` / `rumor` / `opinion` / `propaganda` / `unknown`), 발행 주체,
  관점, 시간 정체성(`eventKey`, `timelineOrder`, `inWorldTime`)을 함께 싣는다. 소문 문서는 그 소문이
  유통되었다는 사실만 뒷받침한다. 시간 정체성이 다른 문서들은 동일한 인물과 행동이 반복되더라도 별개의
  사건으로 유지된다.
- 직접 대화 근거가 요약보다 우선하며, 직접 근거에서 취한 화자와 행위 방향은 뒤집을 수 없다.
- 사용자의 전제가 기억과 충돌하면 캐릭터가 전제를 바로잡는다. 전제에 맞춰 기억을 고쳐 쓰지 않는다.

프로필과 캐릭터 설정은 매 요청마다 각 스토어에서 재조회되어 시스템 프롬프트로 렌더링되고, 검색된
기억은 그 아래에 라벨링된 근거로 주입된다.

검색 근거는 엔드포인트를 추가하지 않고도 확인할 수 있다. 개발 환경에서 `RITA_RAG_TRACE=true`를
설정하면 질의별 후보 ID, 순위, 코사인 거리가 본문이 제거된 채 구조화 로그로 기록된다 —
[docs/rag-tracing.md](docs/rag-tracing.md)와
[ragTraceUtils.ts](packages/server/util/ragTraceUtils.ts) 참고.

### 컨텍스트 조립

[personaEngine.ts](packages/server/service/personaEngine.ts)의 `buildPersonaMessages`는 고정된 메시지
순서를 구성한다.

1. 정적 시스템 프롬프트 — 언어 강제, 서술 규칙, 캐릭터 기준선, 프로필 이름.
2. 장기기억 블록 — 요약, 설정, 역사, 세계 내 문서, 과거 대화. 각각 명시적 라벨 아래 배치된다.
3. 페르소나 응답 계약 — 화자 정체성, 근거 취급, 없는 사실을 만들지 않는 규칙.
4. 단기 기록 — 최근 턴들을 실제 `user`/`assistant` 메시지로 재생한다.
5. 현재 사용자 메시지.

계약은 1번의 시스템 프롬프트에 합쳐지지 않고 3번 자리에 놓인다. 이유는 빌더 자체에 기록되어 있다.
회상된 기억은 3인칭 요약 텍스트이고, 그것이 현재 턴 직전의 마지막 내용이면 모델이 기억 서술자의
목소리를 이어받는 경향이 있다. 기억 블록 뒤에 계약을 다시 진술하면 화자 정체성이 현재 턴에 붙어 있게
된다.

예산 산정 — [tokenBudgetUtils.ts](packages/server/util/tokenBudgetUtils.ts)와
[llmService.ts](packages/server/service/llmService.ts)의 `validateTokenCount`: 입력은
`tiktoken`(`cl100k_base`)으로 계산하고, 가용 입력 예산은 모델의 컨텍스트 윈도우에서
`min(요청 maxTokens, 모델 maxOutputTokens)`을 뺀 값이다. 컨텍스트 윈도우와 최대 출력 토큰을 구분하는
것은 의도적이며, 둘을 혼동하면 윈도우를 조용히 초과 배정하게 된다.

예산을 넘는 요청은 잘라내지 않고 거부한다. 오래된 것부터 버리는 단계적 절삭은 없다. 프롬프트 크기를
실제로 제한하는 것은 조립 이전에 적용되는 고정 검색 상한이다. 소스당 `FINAL_MEMORY_LIMIT = 5`, 대화
턴 초기 후보 30건과 요약 초기 후보 20건, 후속 턴 최대 4개, 문서 본문 4,000자 절단이 그것이다. 모델의
한계값을 알 수 없으면 추정하지 않고 경고를 남긴 뒤 예산 산정을 건너뛴다.

### LLM 호출과 구조화 출력

공급자 차이는 전부 [llmService.ts](packages/server/service/llmService.ts)에 갇혀 있다. 클라이언트는
요청마다 사용자의 복호화된 키([credentialStore.ts](packages/server/store/credentialStore.ts))로
생성되며 OpenAI, Anthropic, Google, OpenRouter를 지원한다.

구조화 출력은 두 경로 중 하나를 탄다.

- **네이티브.** `platform: 'direct'`이면서 OpenAI, Anthropic, Google인 경우 Zod 스키마를
  `withStructuredOutput({ includeRaw: true })`에 전달한다. 공급자 자체 파싱이 아무것도 내놓지 못하면
  실패시키지 않고 원문 메시지를 수동 경로로 다시 파싱한다.
- **수동.** 그 외 전부 — OpenRouter를 포함하고, 모든 스트리밍 호출을 포함한다 — 는 Zod 포맷 지시문을
  시스템 메시지로 앞에 붙이고 이후 원문 텍스트를 파싱한다.

파싱과 검증은
[structuredOutputUtils.ts](packages/server/util/structuredOutputUtils.ts)의 `parseStructuredLlmOutput`
하나로 처리된다. 마크다운 펜스를 제거하고, `JSON.parse`한 뒤, `schema.safeParse`한다. 빈 출력, 깨진
JSON, 스키마 불일치 등 모든 실패 유형은 원문 출력을 실어 나르는 단일
`StructuredOutputValidationError`로 올라오므로 복구 경로가 다룰 재료가 남는다.

복구는 범위가 정해져 있고 명시적이다.

- **수정 시도 1회.** `repairStructuredLlmOutput`은 원문 출력, 실패 사유, 문자열로 기술한 스키마를 저가
  추출 모델에 보내고 결과를 다시 검증한다. 두 번째 실패는 예외를 던진다. 재시도 루프는 없다.
- **품질 저하가 허용되는 지점의 개별 폴백.** 질의 변환은 원문 텍스트로 폴백하고, 보강 결과는
  `_extractChatTurnMetadataInfoFromLlm`에서 필드 단위로 보정되므로 키 하나가 빠졌다고 턴 전체의
  메타데이터를 버리지 않는다.
- **근거 판정을 스키마 필드로.** 페르소나 스키마는 `response`, `emotion`과 함께
  `groundingDecision`(`not_applicable` | `supported` | `contradicted` | `uncertain`)을 요구한다.
  `contradicted` 판정은 거부된 초안을 다시 보내 거짓 전제를 명확히 부정하도록 지시하는 수정 패스를
  1회 발동한다. 이 패스가 겨냥하는 실패는, 모델이 모순을 옳게 탐지하고도 조건부 표현("하긴 했지만…")으로
  전제를 다시 인정하는 경우다.
- **스트리밍도 같은 계약을 지킨다.**
  `PartialJsonStringDecoder`([partialJsonUtils.ts](packages/server/util/partialJsonUtils.ts))는 부분
  토큰 스트림에서 JSON 문자열 필드 하나를 디코딩한다. 덕분에 `groundingDecision`이 아직 읽히는 중에도
  클라이언트는 `response` 텍스트를 도착하는 대로 받는다. 판정이 미해결인 동안 텍스트는 버퍼링되고,
  `contradicted`로 해소되면 버퍼는 폐기되어 클라이언트에 전달되지 않으며 수정본이 대신 스트리밍된다.
  최종 구조화 객체는 스트림 종료 후 여전히 스키마로 검증된다.

모든 대화 요청은 서버 측 `ABORT_TIMEOUT` 타이머에 연결된 `AbortSignal`을 가지므로, 응답하지 않는
공급자 호출은 연결을 붙잡고 있는 대신 턴을 실패시킨다
([orchestrationService.ts](packages/server/service/orchestrationService.ts)).

### 응답 후보와 사람의 선택

턴은 생성 시점에 확정되지 않는다. `receiveBotResponse`는 생성된 `ChatMessageSet`을 현재
`TempChatTurn`에 덧붙이므로, 재생성은 이전 결과를 대체하지 않고 후보를 쌓는다.
[TempTurnDisplay.tsx](packages/client/page/chat/TempTurnDisplay.tsx)에서 사용자는 후보를 넘겨 보거나,
양쪽을 인라인으로 편집하거나, 다시 생성할 수 있다.

확정은 다음 전송 시점에 일어난다([ChatPage.tsx](packages/client/page/chat/ChatPage.tsx)). 화면에 떠
있던 후보가 `ChatTurnCdo`가 되어
[finalizationJobService.ts](packages/server/service/finalizationJobService.ts)로 넘어가고, 이 서비스가
잡을 `finalization_jobs`에 저장한 뒤(최대 3회 시도, `(session_id, sequence)` 유니크) 보강을 응답 경로
밖에서 실행한다. 보강은 고유명사를 추출해 세션 용어집과 대조하고, 해당 캐릭터와 프로필 이름에 맞춰
생성된 스키마 아래에서 요약, 키워드, 주제, 개체, 감정, 설정·역사 참조를 산출한다. 그 이후에야 턴이
`chat_turns`에 들어가고 임베딩된다.

선택되지 않은 후보는 temp row와 함께 폐기되며 거부 예시로 저장되지 않는다. `TempChatTurn.fixedSetNo`는
도메인 타입에 존재하지만 상수로만 기록되고(서버에서 `-1`, 신규 대화 로더에서 `0`), 사용자가 어떤
후보를 골랐는지에서 선호 신호를 도출하는 로직은 현재 없다.

### 계약 경계

`packages/shared`는 나머지 두 패키지가 모두 import하는 유일한 모듈이다. `./api`, `./domain`,
`./config`, `./util` 네 개의 서브경로를 내보내며, `development` 조건은 소스를 `default` 조건은 빌드
산출물을 가리킨다. 따라서 개발 서버는 소스를 기준으로 타입을 검사하고 빌드는 `dist`를 소비한다.

이 패키지가 보장하는 것은 컴파일 타임이다. 응답 봉투
([ModuleResponse.ts](packages/shared/api/ModuleResponse.ts)), 도메인 엔티티, 모델 카탈로그와 한계값
([supportAiModelInfo.ts](packages/shared/config/supportAiModelInfo.ts)), 그리고 양쪽이 함께 쓰는 ID
생성 헬퍼가 여기 있다. 세션, 프로필, 턴 ID가 두 벌이 아니라 한 벌의 구현으로 만들어진다.

런타임 검증은 의도적으로 `shared`에 두지 않는다. 요청 본문과 LLM 출력 Zod 스키마는
[schemaUtils.ts](packages/server/util/schemaUtils.ts)에 있고, 서버는 자기 조회 결과를 신뢰의 원본으로
취급한다. 대화 엔드포인트는 `sessionId`, `sequence`, `entries`, `modelName`만 받으며 캐릭터, 프로필,
모델 설정, 최근 턴은 그 ID들로 서버에서 다시 해석하고 소유권을 다시 확인한다
([orchestration.routes.ts](packages/server/route/orchestration.routes.ts)). 캐릭터 노출 여부도 같은
패턴을 따른다. [characterStore.ts](packages/server/store/characterStore.ts)의
`filterCharacterResponseByViewer`와 `assertCharacterVisibleToUser`가 판단의 원본이고, 클라이언트의
동일 검사는 다층 방어일 뿐이다.

## 패키지

- [packages/client](packages/client): React 19 + Vite 클라이언트와 SSR 엔트리포인트.
- [packages/server](packages/server): Express API/SSR 서버, PostgreSQL 스토어, RAG 서비스, LLM 오케스트레이션.
- [packages/shared](packages/shared): 공유 API, 도메인, 설정, 유틸리티 계약.

## Agentic Coding

이 저장소는 Codex를 비롯한 코딩 에이전트를 위한 프로젝트 수준 지침을 포함한다.

- [AGENTS.md](AGENTS.md): 상시 적용되는 저장소 규칙과 검증 기대치.
- [.agents/skills/rag-change](.agents/skills/rag-change): RAG, LLM, 프롬프트, 스키마, 기억, 모델 변경 워크플로.
- [.agents/skills/tooling-upgrade](.agents/skills/tooling-upgrade): 스크립트, CI, Docker, TypeScript, pnpm, 포매팅, 의존성·툴링 변경 워크플로.
- [docs/agentic-coding.md](docs/agentic-coding.md): 에이전트 워크플로에 대한 사람용 안내.
- [.github/codex/prompts/review.md](.github/codex/prompts/review.md): 향후 Codex PR 리뷰 자동화를 위한 재사용 프롬프트.

RAG/LLM 동작이나 저장소 툴링을 변경하기 전에 해당 skill을 사용한다.

skill을 둘로 나눈 기준은 실패 양상의 차이다. RAG 변경은 출력 품질로 판정되며 프롬프트 텍스트, 스키마,
파싱, 폴백을 함께 검토해야 한다. 반면 툴링 변경은 재현성으로 판정되며 고정된 pnpm 버전과 Docker, CI를
정렬된 상태로 유지해야 한다.

검증을 좁은 것부터 실행하도록 정한 이유는, 전체 게이트가 느리고 넓은 명령이 실패했을 때 어느 패키지가
깨졌는지 알려주지 않기 때문이다. 해당 동작을 소유한 패키지의 빌드를 먼저 돌리면 `pnpm check`를 쓰기
전에 실패 지점이 좁혀진다.

`AGENTS.md`에는 모르고 어기기 쉬운 서버·RAG 관례도 함께 담겨 있다. 브라우저가 보낸 페이로드로 신뢰
상태를 넘기지 말 것, 컨텍스트 윈도우와 최대 출력 토큰을 구분할 것, HTTP 압축을 자체 페이로드 래핑으로
대체하지 말 것.

## 설정

pnpm만 사용한다. 저장소는 `pnpm@10.18.0`에 고정되어 있다.

```bash
corepack enable pnpm
corepack install -g pnpm@10.18.0
pnpm install
```

로컬 개발에서는 `.env.example`을 `.env`로 복사한 뒤 필요한 값을 채운다. 실제 비밀 값을 커밋하지 않는다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 로컬 개발

로컬 PostgreSQL, pgvector, SuperTokens 서비스를 시작한다.

```bash
pnpm db:up
```

`.env.example`의 기본 로컬 서비스 값은 다음과 같다.

- `DATABASE_URL=postgresql://rita:rita@localhost:5432/rita_berenice`
- `DATABASE_SSL=false`
- `SUPERTOKENS_CONNECTION_URI=http://localhost:3567`
- `AUTH_IDENTITY_NAMESPACE=supertokens-dev`

데이터베이스 마이그레이션을 적용한 뒤, Vite 미들웨어를 포함한 Express SSR/API 호스트를 시작한다.

```bash
pnpm db:migrate
pnpm dev
```

`drizzle-kit`을 쓸 수 없는 환경(배포 시점 러너)을 위해 `drizzle-orm` 기반의 경량 마이그레이션 러너를
함께 제공한다.

```bash
DATABASE_URL=... DATABASE_SSL=true pnpm --filter @rita-berenice/server db:migrate:run
```

`http://localhost:3000`을 연다.

로컬 Docker 서비스는 `pnpm db:down`으로 중지한다.

Vite가 `.vite_cache`에서 Windows `EPERM` 이름 변경 오류를 보고하면 `pnpm dev`를 중지하고
`pnpm clean:vite`를 실행한 뒤 `pnpm dev`를 다시 시작한다.

## 주요 명령

```bash
pnpm dev
pnpm build
pnpm build:client
pnpm build:server
pnpm build:shared
pnpm build:static
pnpm typecheck
pnpm format:check
pnpm check
```

`pnpm check`는 포매팅, 타입체크, 전체 Turbo 빌드를 실행한다.

## 검증

가장 좁은 범위의 명령을 먼저 실행한다.

- shared 타입·설정·유틸 변경: `pnpm build:shared`
- 서버·RAG·스토어·라우트 변경: `pnpm build:server`
- 클라이언트·UI·훅 변경: `pnpm build:client`
- 패키지 간 변경 또는 인계 직전: `pnpm check`

명령 실행에 필요한 로컬 서비스나 비밀 값이 없으면 그 사실을 분명히 보고하고, 그것 없이 가능한 검사만
실행한다.

## 배포

- [.github/workflows/ci.yml](.github/workflows/ci.yml)이 포매팅, 타입체크, 패키지 빌드를 실행한다.
- [.github/workflows/fly-deploy-demo.yml](.github/workflows/fly-deploy-demo.yml)이 `main`에서 데모 앱(`rita-berenice-demo.fly.dev`)을 배포한다.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 `mock` 브랜치에서 GitHub Pages용 정적 클라이언트를 빌드한다.
- 데모 [fly.toml](fly.toml)은 `release_command`로 커밋된 스키마 마이그레이션을 매 배포 전에 자동
  적용하고, `AUTO_PROVISION_USERS=true`를 설정해 SuperTokens 신규 가입 시 연결된 Rita 사용자와 정체성
  매핑이 자동으로 생성되도록 한다.

## 라이선스

이 프로젝트는 Rita-Berenice Enhanced Use License v1.0을 따른다.

- 영어: [LICENSE](LICENSE)
- 한국어: [LICENSE.ko](LICENSE.ko)

이 소프트웨어는 어떠한 보증도 없이 "있는 그대로" 제공된다. 사용에 따르는 위험은 사용자가 부담한다.
전체 조항은 라이선스 파일을 참고한다.
