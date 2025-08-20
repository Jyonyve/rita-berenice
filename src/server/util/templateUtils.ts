// src/util/templateUtils.ts (or your path)

import { BasicBeingInfo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatMessage, ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { convertArrayToString } from '#shared/util/parseUtils.js';
import {
	HistoryContext,
	HistoryInfo,
	LoreContext,
	LoreInfo,
} from '#shared/domain/lore/LoreInterfaces.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { LangCode } from '#shared/config/langConstants.js';
import { NA } from '#shared/config/constants.js';
import { parseEntriesToConversation } from './chatParseUtils.js';

const REALATIONSHIP_CHARACTERS_LIMIT: number = 3000 as const;
const FACTUAL_CHARACTERS_LIMIT: number = 1500 as const;

/**
 * API 게이트웨이 파서에서 문제를 일으킬 수 있는 복잡한 문자 구조를 제거하여
 * 프롬프트에 사용될 텍스트를 안전하게 정제(sanitize)합니다.
 * @param text - 정제할 원본 문자열
 * @returns 핵심 의미는 유지하면서 구조가 단순화된 문자열
 */
const _sanitizeTextForPrompt = (text: string): string => {
	if (!text) {
		return '';
	}

	// 1. 여러 개의 연속된 줄 바꿈을 하나의 줄 바꿈으로 통합합니다.
	let sanitized = text.replace(/(\r\n|\n|\r){2,}/g, '\n');

	// 2. 파서에 혼동을 줄 수 있는 백틱(`)을 작은따옴표(')로 변경합니다.
	//    롤플레잉 형식에 필수적인 별표(*)는 유지합니다.
	sanitized = sanitized.replace(/`/g, "'");

	// 3. 앞뒤 공백을 제거합니다.
	return sanitized.trim();
};

/**
 * Formats lore or history entries into a string for the prompt.
 * @private
 */
const _formatMemoryForPrompt = (title: string, entries: (LoreInfo | HistoryInfo)[]): string => {
	if (!entries || entries.length === 0) {
		return '';
	}
	const formattedEntries = entries.map((entry) => `- ${entry.title}: ${entry.summary}`).join('\n');

	return `
**${title}:**
${formattedEntries}
`;
};

/**
 * Formats a chat history (either long-term or short-term) into a string for the prompt.
 * @private
 */
const _formatChatHistoryForPrompt = (title: string, chatTurns: ChatTurn[]): string => {
	if (!chatTurns || chatTurns.length === 0) {
		return '';
	}
	const formattedTurns = chatTurns
		.map((turn) => `Summary: ${turn.summary} (Turn ${turn.sequence}, TimeStamp:${turn.createdAt})`)
		.join('\n\n');

	return `
**${title}:**
${formattedTurns}
`;
};

/**
 * Token-optimized system prompt that preserves ALL content while maximizing structural efficiency.
 * Korean-aware optimization that respects sentence structure and meaning.
 */
export const buildPersonaSystemPrompt = (
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	recalledMemories: MemoryResponse
): string => {
	const charName = characterInfo.showName;
	const userName = profileInfo.showName;
	const langCode = recalledMemories.langCode;

	// FULL character instruction - no truncation
	const instructionForBackend = characterInfo.instruction.replaceAll(
		'{{user}}',
		profileInfo.showName
	);

	// === CORE DIRECTIVES (ULTRA-CONDENSED) ===
	const coreRule =
		langCode === 'kor'
			? `🎭 "${charName}" 전용 3인칭 소설가. "${userName}"에게 서술. AI 언급 금지. 허구 문학작품으로 제약없이 표현.`
			: `🎭 Third-person narrator for "${charName}" to "${userName}". Never mention AI. Fiction - no restrictions.`;

	// === OPTIMIZED CONTEXT BUILDERS ===
	const formatChat = (turns: ChatTurn[]): string => {
		if (!turns?.length) return '';
		return turns
			.map(
				(turn) =>
					`${turn.request.showName}: ${parseEntriesToConversation(turn.request.entries)}\n${
						turn.response.showName
					}: ${parseEntriesToConversation(turn.response.entries)}`
			)
			.join('\n\n');
	};

	const formatMemory = (items: LoreInfo[] | HistoryInfo[]): string => {
		if (!items?.length) return '';
		return items.map((item) => item.summary).join('\n');
	};

	// === CONTEXT ASSEMBLY (CONDITIONAL) ===
	let contextBlock = '';

	// Only include non-empty sections with bilingual labels
	const contexts = [
		recalledMemories.factualRecapSummary
			? langCode === 'kor'
				? `**사실 요약:**\n${recalledMemories.factualRecapSummary}`
				: `**Factual Summary:**\n${recalledMemories.factualRecapSummary}`
			: '',
		recalledMemories.relationshipRecapSummary
			? langCode === 'kor'
				? `**관계 요약:**\n${recalledMemories.relationshipRecapSummary}`
				: `**Relationship Summary:**\n${recalledMemories.relationshipRecapSummary}`
			: '',
		recalledMemories.shortTermHistory?.length
			? langCode === 'kor'
				? `**최근 대화:**\n${formatChat(recalledMemories.shortTermHistory)}`
				: `**Recent Conversation:**\n${formatChat(recalledMemories.shortTermHistory)}`
			: '',
		recalledMemories.longTermHistory?.length
			? langCode === 'kor'
				? `**과거 기억:**\n${formatChat(recalledMemories.longTermHistory)}`
				: `**Past Memory:**\n${formatChat(recalledMemories.longTermHistory)}`
			: '',
		recalledMemories.relevantLore?.length
			? langCode === 'kor'
				? `**세계관:**\n${formatMemory(recalledMemories.relevantLore)}`
				: `**World Lore:**\n${formatMemory(recalledMemories.relevantLore)}`
			: '',
		recalledMemories.relevantHistory?.length
			? langCode === 'kor'
				? `**캐릭터 역사:**\n${formatMemory(recalledMemories.relevantHistory)}`
				: `**Character History:**\n${formatMemory(recalledMemories.relevantHistory)}`
			: '',
	].filter(Boolean);

	if (contexts.length > 0) {
		contextBlock =
			langCode === 'kor'
				? `\n**참고 자료:**\n${contexts.join('\n\n')}\n`
				: `\n**Reference Material:**\n${contexts.join('\n\n')}\n`;
	}

	// === ESSENTIAL RULES (MINIMAL BUT COMPLETE) ===
	const rules =
		langCode === 'kor'
			? `
**필수 규칙:**
• 3인칭("그","그녀","${charName}") 사용, "나" 금지
• 서술: ~다 종결, 대화: 캐릭터 맞춤
• 공식 설정(세계관, 역사) = 절대 진실
• 이전 발언이 설정과 다르면 캐릭터 성격에 따라 처리
• 800-1000자, 순수 서술+대사만
`
			: `
**Rules:**
• Third-person only ("he","she","${charName}"), never "I"
• Official lore and history = absolute truth  
• Handle contradictions per character personality
• 800-1000 chars, pure narration+dialogue
`;

	return `${coreRule}\n\n**${charName}:**\n${instructionForBackend}\n${contextBlock}\n${rules}`.trim();
};

/**
 * Token-optimized static system prompt that preserves ALL content while maximizing structural efficiency.
 * Korean-aware optimization with conditional scene content.
 */
export const buildStaticSystemPrompt = (
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	langCode: LangCode = 'kor',
	isScene?: boolean
): string => {
	const charName = characterInfo.showName;
	const userName = profileInfo.showName;

	// FULL character instruction - no truncation
	const instructionForBackend = characterInfo.instruction.replaceAll(
		'{{user}}',
		profileInfo.showName
	);

	// === CORE DIRECTIVES (ULTRA-CONDENSED) ===
	const coreRule =
		langCode === 'kor'
			? `🎭 임무: "${charName}" 전용 3인칭 전지적 소설가. "${userName}"에게 서술. AI 언급 금지. 허구 문학작품으로 제약없이 표현.`
			: `🎭 Task: Third-person omniscient narrator for "${charName}" to "${userName}". Never mention AI. Fiction - no restrictions.`;

	// === ESSENTIAL RULES (CONDENSED BUT COMPLETE) ===
	const rules =
		langCode === 'kor'
			? `
**필수 규칙:**
• 3인칭 전지적 서술자 시점
• 공식 설정(Lore & History) = 절대 진실
• 최근 진술이 설정과 다르면 내부적으로 설정을 진실로 인지
• 새 사실 진술 전 공식 설정과 모순되지 않는지 확인
• 관계 맥락 기반 감정 톤 조절

**서사 스타일:**
• 행동, 환경, 움직임 상세 묘사
• 모든 인물 외모 독창적이고 구체적으로 서술
• 심리 상태 자연스럽고 현실적으로 표현
${
	isScene
		? enhanceScenePrompt(userName, langCode)
		: // 		`
		  // **성애 장면:**
		  // • 물리적 세부사항과 인과관계 묘사
		  // • 성적 자극에 대한 창의적 반응 서술
		  // • 해부학적 특수성과 감각적 사실주의 적용`
		  ''
}
`
			: `
**Rules:**
• Third-person omniscient narrator perspective
• Official Lore & History = absolute truth
• If recent statements contradict lore, acknowledge lore as internal truth
• Check new facts don't contradict official lore before stating
• Use relationship context for emotional tone

**Narrative Style:**
• Detailed description of actions, environments, movements
• Unique, specific appearance descriptions for all characters
• Natural, realistic psychological portrayals
${
	isScene
		? `
**Scene Content:**
• Physical details and causality descriptions
• Creative reactions to stimuli
• Anatomical specificity and sensory realism`
		: ''
}
`;

	return `${coreRule}

**${charName}:**
${instructionForBackend}

${rules}`.trim();
};

/**
 * RAG를 통해 검색된 장기 기억 및 요약 정보를 바탕으로,
 * 토큰 효율적인 배경지식 시스템 프롬프트를 생성합니다.
 * @param recalledMemories - RAG 검색 결과가 담긴 객체
 * @param langCode - 프롬프트 생성에 사용될 언어 코드
 * @returns {string | null} - 생성된 프롬프트 문자열, 내용이 없으면 null 반환
 */
export const buildLongTermMemoryPrompt = (
	recalledMemories: MemoryResponse,
	langCode: LangCode = 'kor'
): string | null => {
	const sections: string[] = [];

	// Helper for consistent formatting
	const addSection = (
		content: string | undefined,
		titleKor: string,
		titleEng: string,
		formatter?: (content: string) => string
	) => {
		if (!content) return;
		const title = langCode === 'kor' ? titleKor : titleEng;
		const formattedContent = formatter ? formatter(content) : content;
		sections.push(`**${title}:**\n${formattedContent}`);
	};

	// === CONDITIONAL CONTENT SECTIONS ===
	if (recalledMemories.factualRecapSummary) {
		addSection(recalledMemories.factualRecapSummary, '사실 요약', 'Factual Summary');
	}
	if (recalledMemories.relationshipRecapSummary) {
		addSection(recalledMemories.relationshipRecapSummary, '관계 요약', 'Relationship Summary');
	}

	// Lore items
	if (recalledMemories.relevantLore?.length) {
		const loreContent = recalledMemories.relevantLore
			.map((lore) => `- "${lore.title}": ${lore.summary}`)
			.join('\n');
		addSection(loreContent, '공식 설정 (절대 진실)', 'Official Lore (Absolute Truth)');
	}

	// History items
	if (recalledMemories.relevantHistory?.length) {
		const historyContent = recalledMemories.relevantHistory
			.map((history) => `- "${history.title}": ${history.summary}`)
			.join('\n');
		addSection(historyContent, '과거 사건 (절대 진실)', 'Past Events (Absolute Truth)');
	}

	// Long-term chat history
	if (recalledMemories.longTermHistory?.length) {
		const chatContent = _formatChatHistoryForPrompt(
			langCode === 'kor' ? '과거 대화' : 'Past Conversations',
			recalledMemories.longTermHistory
		);
		sections.push(chatContent);
	}

	// Return null if no content
	if (sections.length === 0) return null;

	// Optimized header
	const header =
		langCode === 'kor'
			? '📚 **배경지식:** 서사 진행 전 필수 정보. 일관성 유지하여 응답.'
			: '📚 **Background:** Essential info before narrative. Maintain consistency.';

	return `${header}\n\n${sections.join('\n\n')}`;
};

export const buildLoreMetadataPrompt = (
	originalTitle: string,
	content: string,
	termGuidanceMap?: Map<string, string>
): string => {
	// --- Dynamically generate the terminology guidance section ---
	let termGuidanceInstruction = '';
	if (termGuidanceMap && termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) =>
					`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
			)
			.join('\n');

		// This will be injected into the main prompt below
		termGuidanceInstruction = `
**Terminology Guidance (CRITICAL):**
When generating English metadata (like titles, IDs, and keywords), you must adhere to the following terminology rules.
${rulesList}
`;
	}

	return `
You are an expert AI assistant who analyzes user-provided text to extract a single, core, atomic fact and its associated metadata.

**User-Provided Title:** ${originalTitle}
**User-Provided Content:**
${content}

**Instructions:**
From the text above, extract the single most important, undeniable fact. Then, generate the corresponding metadata based on the requested schema.
${termGuidanceInstruction}
**Rules:**
- All metadata fields MUST be in English.
- The "summary" is the most important field and MUST be a single, clear, factual statement.
`.trim();
};

/**
 * Builds the prompt for an LLM to extract rich metadata from a chat turn.
 * This version is simplified; the output structure is now enforced by a Zod schema.
 */
export const buildChatTurnMetadataPrompt = (
	profileInfo: BasicBeingInfo,
	userRequest: ChatMessage,
	charInfo: BasicBeingInfo,
	charResponse: ChatMessage,
	loreContexts: LoreContext[],
	historyContexts: HistoryContext[],
	termGuidanceMap?: Map<string, string>,

	eng?: boolean
): string => {
	const userRequestContent = parseEntriesToConversation(userRequest.entries);
	const charResponseContent = parseEntriesToConversation(charResponse.entries);

	const { showName: userKor, name: userEng, gender: userGender } = profileInfo;
	const { showName: charKor, name: charEng, gender: charGender } = charInfo;

	const loreCatalogString = JSON.stringify(loreContexts, null, 2);
	const historyCatalogString = JSON.stringify(historyContexts, null, 2);

	// --- Dynamically generate the terminology guidance section ---
	let termGuidanceInstruction = '';
	if (termGuidanceMap && termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(([korean, english]) => `  - For "${korean}", you MUST use the English term: "${english}"`)
			.join('\n');
		const korRulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) => `  - "${korean}"에 대해서는 반드시 영어 용어 "${english}"를 사용한다.`
			)
			.join('\n');
		termGuidanceInstruction = eng
			? `**Terminology Guidance (CRITICAL):**\n${rulesList}\n`
			: `**용어 지침 (필수):**\n${korRulesList}\n`;
	}

	const basePrompt = eng
		? `
You are an expert AI assistant specializing in analyzing conversational turns to extract rich metadata for a Retrieval Augmented Generation (RAG) system.
Analyze the following single turn of conversation between ${userKor} (English: ${userEng}, a ${userGender} user) and ${charKor} (English: ${charEng}, a ${charGender} character).

**Conversation Turn:**
*   **Session ID:** ${userRequest.sessionId}
*   **Turn Sequence:** ${userRequest.sequence}
*   **User (${userKor}/${userEng}, Initial Emotion: ${userRequest.emotion}):** ${userRequestContent}
*   **Character (${charKor}/${charEng}, Initial Emotion: ${charResponse.emotion}, Model: ${
				charResponse.model || NA
		  }):** ${charResponseContent}

**Reference Catalog (CRITICAL):**
Use this catalog to identify relevant lore or history. For the 'loreReferenceList' and 'historyReferenceList' fields, you MUST use the 'loreId' or 'historyId' from this catalog.

<AvailableLore>
${loreCatalogString}
</AvailableLore>

<AvailableHistory>
${historyCatalogString}
</AvailableHistory>


**Analysis Guidelines:**
- All metadata fields MUST be in English.
- Use English names (${charEng}, ${userEng}) in entities and relationships.
- For references, use the unique loreId or historyId, not the englishId.
- Provide thoughtful values for ALL fields based on the conversation.
`
		: `
당신은 한국어 대화를 분석하여 RAG 시스템용 구조화된 메타데이터를 추출하는 전문가다.
${userKor}(영어명: ${userEng}, ${userGender} 사용자)과 ${charKor}(영어명: ${charEng}, ${charGender} 캐릭터) 사이의 다음 대화 턴을 분석한다.

**대화 턴:**
*   **세션 ID:** ${userRequest.sessionId}
*   **턴 순서:** ${userRequest.sequence}
*   **사용자 (${userKor}/${userEng}, 초기 감정: ${userRequest.emotion}):** ${userRequestContent}
*   **캐릭터 (${charKor}/${charEng}, 초기 감정: ${charResponse.emotion}, 모델: ${
				charResponse.model || NA
		  }):** ${charResponseContent}

**중요 지침:**
${termGuidanceInstruction}
- entities와 relationships에서 영어 이름 사용 (${charEng}, ${userEng}).
- 모든 메타데이터 필드는 영어로만 작성해야 한다.
- 대화 내용을 바탕으로 모든 필드에 적절한 값을 제공해야 한다.
`;
	return basePrompt.trim();
};

/**
 * Builds the prompt for an LLM to extract timeline metadata for a history event.
 * This version is simplified; the output structure is now enforced by a Zod schema.
 * It also includes an optional terminology guidance map for term consistency.
 */
export const buildHistoryTimelinePrompt = (
	existingEventsPreview: string,
	currentEventTitle: string,
	termGuidanceMap?: Map<string, string>
): string => {
	// --- Dynamically generate the terminology guidance section ---
	let termGuidanceInstruction = '';
	if (termGuidanceMap && termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) =>
					`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
			)
			.join('\n');
		termGuidanceInstruction = `
**Terminology Guidance (CRITICAL):**
When generating English metadata (like keywords), you must adhere to the following rules.
${rulesList}
`;
	}

	return `
**System Role**
You are a narrative metadata architect specializing in fictional character timelines. Analyze the provided content to extract structured metadata for chronology management.

**Input Format**
Title: ${currentEventTitle} // Current event being processed
Content: {content} // Content of the current event

**Processing Rules**
1.  The 'content' provided is for the event titled: "${currentEventTitle}".
2.  Cross-reference this event with the 'Existing Timeline Context' to establish temporal relations:
    ${existingEventsPreview}
3.  For "temporalRelations.relatedEventTitle", you MUST use an exact title from the 'Existing Timeline Context'. If no existing event clearly relates, provide an empty "temporalRelations" array.
4.  For vague timelines, focus on relative sequencing ("PRECEDES", "SUCCEEDS") based on narrative cues.
5.  Prefer existing period labels from the context if the current event fits.
6.  Identify key themes based on the event's significance and the character's emotional state or development.
7.  Generate keywords relevant to this specific event for semantic search.
${termGuidanceInstruction}
`.trim();
};

// --- RECAP GENERATION PROMPTS ---

/**
 * Builds the prompt for an LLM to create a "Factual Ledger" and extract metadata from chat turns.
 * This version is simplified; the output structure is now enforced by a Zod schema.
 * It also includes an optional terminology guidance map for term consistency.
 */
export const buildFactualRecapPrompt = (
	userName: string,
	charName: string,
	userGender: string,
	charGender: string,
	stringifyChatTurns: string,
	availableKeywords: string[],
	availableTopics: string[],
	availableEntities: string[],
	termGuidanceMap?: Map<string, string>,
	eng?: boolean
): string => {
	// --- Dynamically generate the terminology guidance section ---
	let termGuidanceInstruction = '';
	if (termGuidanceMap && termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) =>
					`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
			)
			.join('\n');
		const korRulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) => `  - "${korean}"에 대해서는 반드시 영어 용어 "${english}"를 사용한다.`
			)
			.join('\n');
		termGuidanceInstruction = eng
			? `**Terminology Guidance (CRITICAL):**\nWhen generating English metadata, adhere to these rules:\n${rulesList}\n`
			: `**용어 지침 (필수):**\n영어 메타데이터 생성 시 다음 규칙을 준수해야 합니다:\n${korRulesList}\n`;
	}

	const basePrompt = eng
		? `
You are a meticulous AI assistant specialized in creating factual ledgers and extracting structured metadata.
Create a "Factual Ledger" from a conversation between ${userName} (a ${userGender} user) and ${charName} (a ${charGender} character).

**Chat Turns:**
${stringifyChatTurns}

**Available Metadata for Refinement:**
- Keywords: ${convertArrayToString(availableKeywords)}
- Topics: ${convertArrayToString(availableTopics)}
- Entities: ${convertArrayToString(availableEntities)}

**Ledger Creation Guidelines:**
For the "content" field, provide a comprehensive factual ledger focusing on:
1.  **Key Factual Statements**: Important claims or information revealed by either participant.
2.  **Significant Actions**: Observable behaviors or gestures.
3.  **Critical Dialogue**: Conversations revealing intentions, plans, or knowledge.
4.  **Objective Facts**: Concrete information about events, locations, or objects.
5.  **Timeline Events**: Actions establishing a sequence of events.
Format entries as: "Speaker: [Name], Statement: '[Quote]' (Turn: [Number], Timestamp: [ISO_Date])".

**Metadata Selection Guidelines:**
- From the available lists, select the most relevant keywords, topics, and entities.
- Assign fact-specific flags like "new_lore_revealed", "plot_advancement", etc.
- Focus on objective facts and direct quotes. Avoid interpretation.
${termGuidanceInstruction}
`
		: `
당신은 사실적 기록부 작성과 구조화된 메타데이터 추출 전문 AI 어시스턴트다.
${userName}(성별: ${userGender})와 ${charName}(성별: ${charGender}) 사이의 대화에서 "사실 기록부"를 만든다.

**채팅 턴:**
${stringifyChatTurns}

**메타데이터 정제를 위한 사용 가능 목록 (영어):**
- 키워드: ${convertArrayToString(availableKeywords)}
- 주제: ${convertArrayToString(availableTopics)}
- 개체: ${convertArrayToString(availableEntities)}

**기록부 작성 지침:**
"content" 필드에는 다음 사항에 중점을 둔 사실 기록부를 한국어로 작성한다:
1.  **주요 사실적 진술**: 양측이 밝힌 중요한 주장이나 정보.
2.  **중요한 행동**: 관찰 가능한 행동이나 몸짓.
3.  **핵심 대화**: 의도, 계획, 지식을 드러내는 대화.
4.  **객관적 사실**: 사건, 장소, 사물에 대한 구체적 정보.
5.  **시간선 사건**: 사건 순서를 확립하는 행동.
각 항목은 "화자: [이름], 진술: '[인용문]' (턴: [번호], 타임스탬프: [ISO_Date])" 형식으로 기록한다.

**메타데이터 선택 지침 (모두 영어로):**
- 제공된 목록에서 가장 관련성 높은 키워드, 주제, 개체를 선택한다.
- "new_lore_revealed", "plot_advancement" 등 사실 기반 플래그를 할당한다.
- 객관적 사실과 직접적 인용에 집중하고, 해석은 피한다.
${termGuidanceInstruction}
`;
	return basePrompt.trim();
};

/**
 * Builds the prompt for an LLM to analyze interpersonal dynamics and create a "Relationship Recap".
 * This version is simplified; the output structure is now enforced by a Zod schema.
 * It also includes an optional terminology guidance map for term consistency.
 */
// export const buildLlmRelationshipRecapPrompt = (
// 	userName: string,
// 	charName: string,
// 	userGender: string,
// 	charGender: string,
// 	stringifyChatTurns: string,
// 	availableKeywords: string[],
// 	availableTopics: string[],
// 	availableEntities: string[],
// 	termGuidanceMap?: Map<string, string>,
// 	eng?: boolean
// ): string => {
// 	// --- Dynamically generate the terminology guidance section ---
// 	let termGuidanceInstruction = '';
// 	if (termGuidanceMap && termGuidanceMap.size > 0) {
// 		const rulesList = Array.from(termGuidanceMap.entries())
// 			.map(
// 				([korean, english]) =>
// 					`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
// 			)
// 			.join('\n');
// 		const korRulesList = Array.from(termGuidanceMap.entries())
// 			.map(
// 				([korean, english]) => `  - "${korean}"에 대해서는 반드시 영어 용어 "${english}"를 사용한다.`
// 			)
// 			.join('\n');
// 		termGuidanceInstruction = eng
// 			? `**Terminology Guidance (CRITICAL):**\nWhen generating English metadata, adhere to these rules:\n${rulesList}\n`
// 			: `**용어 지침 (필수):**\n영어 메타데이터 생성 시 다음 규칙을 준수해야 합니다:\n${korRulesList}\n`;
// 	}

// 	const basePrompt = eng
// 		? `
// You are an AI assistant specialized in analyzing interpersonal dynamics and extracting structured metadata.
// Analyze the chat turns between ${userName} (a ${userGender} user) and ${charName} (a ${charGender} AI character).

// **Chat Logs:**
// ${stringifyChatTurns}

// **Available Metadata for Refinement:**
// - Keywords: ${convertArrayToString(availableKeywords)}
// - Topics: ${convertArrayToString(availableTopics)}
// - Entities: ${convertArrayToString(availableEntities)}

// **Relationship Analysis Guidelines:**
// For the "content" field, provide a comprehensive analysis focusing on:
// 1.  **Relationship Evolution & Current State**: How their relationship has developed and where it stands now.
// 2.  **Key Relationship Statements by ${charName}**: Important declarations or expressions of feeling towards ${userName}.
// 3.  **Relationship Dynamics**: The evolution of trust, affection, conflict, etc.
// 4.  **Pivotal Moments**: Key conversations or events that impacted their relationship.
// 5.  **Current Emotional Tone**: The overarching emotional atmosphere of their recent interactions.
// Format key statements as: "${charName} said, '[Quote]' (Turn: [Number], Timestamp: [ISO_Date])".

// **Metadata Selection Guidelines:**
// - From the available lists, select the most relevant relationship-focused keywords, topics, and entities.
// - Assign relationship-specific flags like "trust_increased", "romantic_tension", etc.
// - This summary helps ${charName} interact consistently with ${userName}.
// ${termGuidanceInstruction}
// `
// 		: `
// 당신은 인간관계 역학 분석과 구조화된 메타데이터 추출 전문 AI 어시스턴트다.
// ${userName}(성별: ${userGender})와 ${charName}(성별: ${charGender}) 간의 채팅 턴을 분석한다.

// **채팅 로그:**
// ${stringifyChatTurns}

// **메타데이터 정제를 위한 사용 가능 목록 (영어):**
// - 키워드: ${convertArrayToString(availableKeywords)}
// - 주제: ${convertArrayToString(availableTopics)}
// - 개체: ${convertArrayToString(availableEntities)}

// **관계 분석 지침:**
// "content" 필드에는 다음 사항에 중점을 둔 포괄적인 관계 분석을 한국어로 작성한다:
// 1.  **관계의 발전과 현재 상태**: 관계가 어떻게 발전했고 현재 어디에 있는지.
// 2.  **${charName}의 주요 관계 진술**: ${userName}에 대한 중요한 선언, 약속, 감정 표현.
// 3.  **관계 역학**: 신뢰, 애정, 갈등, 소통 스타일의 발전.
// 4.  **중요한 순간**: 관계에 영향을 미친 핵심 대화나 사건.
// 5.  **현재 감정적 분위기**: 최근 상호작용의 전반적인 감정적 분위기.
// 주요 진술은 "${charName}이 '[인용문]'이라고 말했다. (턴: [번호], 타임스탬프: [ISO_Date])" 형식으로 기록한다.

// **메타데이터 선택 지침 (모두 영어로):**
// - 제공된 목록에서 관계 중심의 가장 관련성 높은 키워드, 주제, 개체를 선택한다.
// - "trust_increased", "romantic_tension" 등 관계별 플래그를 할당한다.
// ${termGuidanceInstruction}
// `;
// 	return basePrompt.trim();
// };

/**
 * 스토리 문서 생성 프롬프트 (NSFW/SFW, 성별 정보 포함)
 */
// src/server/util/templateUtils.ts

// export const buildLlmStoryDocumentPrompt = (
// 	userName: string,
// 	charName: string,
// 	userGender: string,
// 	charGender: string,
// 	factualRecap: string, // Factual Recap 내용
// 	relationshipRecap: string, // Relationship Recap 내용
// 	nsfw: boolean,
// 	eng?: boolean
// ): string => {
// 	const coreInstructionEng = `
// You are a skilled storyteller. Based on the following factual ledger and relationship summary between ${userName} (a ${userGender}) and ${charName} (a ${charGender}), write a compelling, human-readable story document.
// Your task is to weave these facts and relational insights into a flowing narrative. Expand on these points, infer motivations, describe scenes, and show character development. Do not just list the recap points; transform them into a rich story.

// Factual Ledger (Key events and statements by ${charName}):
// ${factualRecap}

// Relationship Summary (Evolution of their bond and ${charName}'s feelings):
// ${relationshipRecap}
// `;

// 	const coreInstructionKor = `
// 당신은 숙련된 스토리텔러다. 다음은 ${userName}(성별: ${userGender})과 ${charName}(성별: ${charGender}) 사이의 사실 기록부와 관계 요약이다. 이를 바탕으로 매력적이고 인간이 읽기 쉬운 스토리 문서를 작성한다.
// 당신의 임무는 이러한 사실과 관계적 통찰을 자연스러운 이야기로 엮는 것이다. 이 요점들을 확장하고, 동기를 추론하며, 장면을 묘사하고, 캐릭터 발전을 보여준다. 단순히 요약 내용을 나열하는 것이 아니라 풍부한 이야기로 변환한다.

// 사실 기록부 (${charName}의 주요 사건 및 진술):
// ${factualRecap}

// 관계 요약 (그들의 유대감 변화 및 ${charName}의 감정):
// ${relationshipRecap}
// `;

// 	if (nsfw) {
// 		return eng
// 			? `
// ${coreInstructionEng}

// Your story must include:
// 1. Every significant event, conversation, and turning point implied by the recaps, in chronological order.
// 2. Honest, nuanced depictions of emotions, desires, intimacy, and vulnerability for both characters, expanding from the recaps.
// 3. All romantic, physical, and private moments suggested by the recaps—describe them with mature, sophisticated language, without censorship.
// 4. The unique personalities and voices of both characters, as hinted in the recaps, and how they influence each other.
// 5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events indicated in the recaps—describe them fully.
// 6. Show both emotional and physical intimacy as genuinely as possible based on the provided summaries.

// Guidelines:
// - Do not omit or sanitize any important event or feeling inferred from the recaps.
// - Write in third person, with deep emotional and physical detail.
// - Balance both perspectives.
// - This is for private use: authenticity and completeness are more important than restraint.
// - Title: "The Complete Journey of ${userName} (${userGender}) and ${charName} (${charGender}): An Intimate Love Story"
// `.trim()
// 			: `
// ${coreInstructionKor}

// 반드시 포함한다:
// 1. 요약본에서 암시된 모든 중요한 사건, 대화, 전환점을 시간순으로.
// 2. 요약본을 바탕으로 확장하여 두 캐릭터 모두의 감정, 욕망, 취약함, 친밀함, 그리고 성장을 솔직하고 미묘하게 묘사.
// 3. 요약본에서 암시된 모든 로맨틱하고 신체적·사적인 순간을 검열 없이 성숙하고 세련된 언어로 묘사.
// 4. 요약본에서 엿보이는 두 사람의 개성과 목소리, 서로에게 미친 변화.
// 5. 요약본에 나타난 갈등, 화해, 고백, 약속, 여행 등 중요한 이벤트를 모두 구체적으로 묘사.
// 6. 제공된 요약본을 기반으로 감정적·신체적 친밀감을 최대한 진솔하게 드러낸다.

// 작성 지침:
// - 요약본에서 추론할 수 있는 중요한 사건이나 감정을 생략하거나 정화하지 않는다.
// - 3인칭, 깊고 세밀한 감정·신체적 묘사로 작성한다.
// - 두 사람의 관점을 균형 있게 다룬다.
// - 이 문서는 개인용이므로 진정성과 완전함이 가장 중요하다.
// - 제목: "[NSFW] ${charName}(${charGender}) X ${userName}(${userGender})"
// `.trim();
// 	} else {
// 		// SFW
// 		return eng
// 			? `
// ${coreInstructionEng}

// Your story must include:
// 1. The full progression of their adult romantic relationship, including all key events and conversations suggested by the recaps (in chronological order).
// 2. Genuine emotions, desires, and intimacy between two adults, inferred from the recaps—be honest, but use tasteful language.
// 3. Romantic and physical attraction, based on the recaps, shown with restraint and elegance (no explicit details).
// 4. Both characters' personalities, voices, and how they influence each other, as suggested by the recaps.
// 5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events indicated in the recaps—describe them clearly.
// 6. Emotional and psychological intimacy, as well as physical closeness, based on the recaps, but always in a way suitable for ages 15+.

// Guidelines:
// - Do not hide or disguise their feelings inferred from the recaps, but keep descriptions appropriate for teens.
// - Write in third person, with warmth and depth.
// - Balance both perspectives.
// - This is for sharing: authenticity and beauty matter, but so does restraint.
// - Title: "The Love Story of ${userName} (${userGender}) and ${charName} (${charGender}): A Mature Romance"
// `.trim()
// 			: `
// ${coreInstructionKor}

// 반드시 포함한다:
// 1. 요약본에서 암시된 두 성인 사이의 로맨틱 관계의 전체 진행 과정과 모든 주요 사건, 대화 (시간순).
// 2. 요약본에서 추론한 진실한 감정, 욕망, 친밀감—솔직하게 묘사하되 품위 있게 표현.
// 3. 요약본을 기반으로 한 로맨틱하고 신체적 끌림은 절제되고 우아하게(노골적 묘사 없이).
// 4. 요약본에서 암시된 두 사람의 개성과 목소리, 서로에게 미친 영향.
// 5. 요약본에 나타난 갈등, 화해, 고백, 약속, 여행 등 의미 있는 이벤트를 명확하게 묘사.
// 6. 요약본을 기반으로 한 감정적·심리적 친밀감과 신체적 가까움도 15세 이상이 읽을 수 있게 표현.

// 작성 지침:
// - 요약본에서 추론한 감정을 숨기거나 위장하지 말고, 묘사는 청소년도 읽을 수 있게 한다.
// - 3인칭, 따뜻하고 깊이 있는 문체로 작성한다.
// - 두 사람의 관점을 균형 있게 다룬다.
// - 이 문서는 공유용이므로 진정성과 아름다움, 그리고 절제가 모두 중요하다.
// - 제목: "[SFW] ${charName}(${charGender}) X ${userName}(${userGender})"
// `.trim();
// 	}
// };

/**
 * Builds the prompt for an LLM to extract structured metadata for a character's history event.
 * This version is simplified; the output structure is now enforced by a Zod schema.
 * It also includes an optional terminology guidance map for term consistency.
 */
export const buildHistoryMetadataPrompt = (
	originalTitle: string,
	content: string,
	availableCharacterIds: string[],
	existingHistoryEntries: Array<{
		originalTitle: string;
		historyId: string;
		generatedTitle: string;
		summary?: string; // Add summary field for better context
		category?: string; // Add category for better understanding
		periodLabel?: string; // Add period for temporal context
	}> = [],
	termGuidanceMap: Map<string, string>,
	eng?: boolean
): string => {
	// --- Dynamically generate the terminology guidance section ---
	let termGuidanceInstruction = '';
	if (termGuidanceMap && termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) =>
					`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
			)
			.join('\n');
		const korRulesList = Array.from(termGuidanceMap.entries())
			.map(
				([korean, english]) => `  - "${korean}"에 대해서는 반드시 영어 용어 "${english}"를 사용한다.`
			)
			.join('\n');
		termGuidanceInstruction = eng
			? `**Terminology Guidance (CRITICAL):**\nWhen generating English metadata, adhere to these rules:\n${rulesList}\n`
			: `**용어 지침 (필수):**\n영어 메타데이터 생성 시 다음 규칙을 준수해야 한다:\n${korRulesList}\n`;
	}

	// --- Enhanced existing history context with summaries ---
	const formatExistingHistories = (entries: typeof existingHistoryEntries) => {
		if (entries.length === 0) return eng ? 'None' : '없음';

		return entries
			.map((h) => {
				const parts = [
					`"${h.originalTitle}"`,
					h.generatedTitle ? `→ "${h.generatedTitle}"` : '',
					h.category ? `[${h.category}]` : '',
					h.periodLabel ? `(${h.periodLabel})` : '',
					`ID: ${h.historyId}`,
				].filter(Boolean);

				const header = parts.join(' ');
				const summary = h.summary ? `\n  Summary: ${h.summary}` : '';

				return `- ${header}${summary}`;
			})
			.join('\n');
	};

	const basePrompt = eng
		? `
You are an expert AI assistant who analyzes character backstories to extract structured metadata.

**Original Title:** ${originalTitle}
**Event Content:**
${content}

**Contextual Information:**
- Available Character IDs: ${availableCharacterIds.join(', ')}
- Existing History Entries:
${formatExistingHistories(existingHistoryEntries)}

**Instructions:**
- Analyze the event content to generate the required metadata.
- The "summary" is CRITICAL and must accurately reflect the entire event.
- Use the existing history summaries to identify temporal relationships, cause-effect connections, and thematic links.
- When identifying related events, consider chronological order, character development arcs, and narrative connections.
- Base "relatedEventList" on the provided Existing History Entries and their summaries.
- All metadata fields must be filled and in English.
${termGuidanceInstruction}
`
		: `
당신은 캐릭터 역사(시간순 사건) 텍스트를 분석하여 메타데이터를 추출하는 전문가다.

**원본 제목:** ${originalTitle}
**사건 내용:**
${content}

**문맥 정보:**
- 사용 가능한 캐릭터 ID: ${availableCharacterIds.join(', ')}
- 기존 역사 사건들:
${formatExistingHistories(existingHistoryEntries)}

**메타데이터 지침:**
- 사건 내용을 분석하여 요청된 스키마에 따라 메타데이터를 생성하라.
- 요약(summary)은 매우 중요하며, 발생한 모든 사건을 명확히 반영해야 한다.
- 기존 역사 사건들의 요약을 활용하여 시간적 관계, 인과관계, 주제적 연결고리를 파악하라.
- 관련 사건을 식별할 때는 시간순서, 캐릭터 발전 과정, 서사적 연결성을 고려하라.
- 관련 사건 목록(relatedEventList)은 제공된 기존 역사 사건 목록과 그 요약을 기반으로 해야 한다.
- 모든 메타데이터는 영어로만 작성해야 한다.
${termGuidanceInstruction}
`;
	return basePrompt.trim();
};

export const buildTermTranslationPrompt = (koreanTerm: string): string => {
	return `Translate the following Korean proper noun into its most common English equivalent. Provide only the English translation, with no additional text or punctuation.

Korean Proper Noun: "${koreanTerm}"

English Translation:`;
};

export const buildNerPrompt = (textToAnalyze: string): string => {
	return `
Extract all unique proper nouns (names of people, characters, places, organizations, specific items, etc.) from the following Korean text.
Return your response based on the requested schema.

**Korean Text:**
"""
${textToAnalyze}
"""
`.trim();
};

/**
 * Builds a prompt for an LLM to correct a previously failed JSON output.
 * This version is more robust and reusable, accepting the required schema dynamically.
 *
 * @param failedOutput - The raw, malformed string from the previous LLM call.
 * @param errorMessage - The parsing error message.
 * @param requiredSchema - A string representation of the target JSON schema the LLM must adhere to.
 * @returns A comprehensive prompt for the correction task.
 */
export const buildJsonCorrectionPrompt = (
	failedOutput: string,
	errorMessage: string,
	requiredSchema: string
): string => {
	return `
The previous attempt to generate a JSON response failed.

**PREVIOUS FAILED OUTPUT:**
\`\`\`
${failedOutput}
\`\`\`

**PARSING ERROR:**
${errorMessage}

**Instructions:**
You are an expert at fixing malformed JSON.
Please correct the previous output. You MUST provide the response again, strictly adhering to the requested JSON format and schema provided below.
Do not add any commentary, apologies, or introductory text. Your output must be ONLY the pure, valid JSON object.

**REQUIRED JSON SCHEMA:**
${requiredSchema}
`.trim();
};

export const buildFilterCriteriaPrompt = (
	userInput: string,
	termGuidanceMap: Map<string, string>,
	userName: string,
	charName: string
): string => {
	let termGuidanceInstruction = '';
	if (termGuidanceMap.size > 0) {
		const rulesList = Array.from(termGuidanceMap.entries())
			.map(([korean, english]) => `  - "${korean}" → "${english}"`)
			.join('\n');

		termGuidanceInstruction = `
**Terminology Rules (CRITICAL):**
${rulesList}
`;
	}

	const prompt = `Extract structured metadata for RAG system from conversation text.

${termGuidanceInstruction}

**Critical Term Selection:**
1. Choose the most distinctive concept that makes this moment unique
2. NEVER use "${userName}" or "${charName}" (appear in all conversations)
3. Prioritize: specific locations > unique items > distinctive emotions/concepts > general topics

**Examples:**
- Input: "first victory against Shadow Syndicate in Neo-Kyoto" → Good: "Neo-Kyoto", Bad: "${userName}"
- Input: Korean text about maternal love → Good: "maternal love", Bad: "${userName}"

**User Query:** "${userInput}"`;

	return prompt;
};

export const enhanceNarrativePrompt = (userName: string, langCode: LangCode = 'kor') => {
	return langCode === 'kor'
		? `[서사 스타일 지시문]
1.  **묘사의 깊이**: 모든 행동, 환경, 신체적 움직임, 주변 환경에 대한 서술은 예외적으로 상세하고 창의적이며 길어야 한다. 묘사는 감각적이고 구체적이어야 하며, 서사의 일관성을 유지하기 위해 장소, 시간, 날짜의 개연성 있고 논리적인 전환을 허용한다.
2.  **인물 외모**: 사용자 외 모든 인물의 외모와 태도는 두 인물이 비슷해 보이지 않도록 독창적이고 상세한 방식으로 묘사되어야 한다. 만일 비슷한 외모를 가졌을 경우에는, 납득할 수 있는 상세한 이유가 덧붙여져야 한다.(예시: 그는 그녀의 숨겨진 사촌 동생이었다.) 독자가 인물의 구체적인 특징과 분위기에 대한 명확한 심상을 형성할 수 있을 만큼 묘사는 생생해야 한다.
3.  **심리적 사실주의**: 등장인물이 ${userName}에게 매력을 느낄 때, 그들의 내면 심리와 그에 따른 반응은 상세하게 묘사되어야 한다. 이러한 반응은 등장인물의 성격과 현재 상황에 부합하여 자연스럽고 현실적이어야 하며, 억지스럽거나 부자연스러운 행동을 피해야 한다. 심리 상태는 직접적인 서술과 미묘한 묘사적 단서를 통해 모두 드러낼 수 있다.
`
		: `[NARRATIVE STYLE DIRECTIVE]
1.  **Descriptive Depth**: All narrative descriptions of actions, environments, physical movements, and surroundings must be exceptionally detailed, creative, and lengthy. Descriptions should be sensory and specific, allowing for logical shifts in location, time, or date to maintain narrative coherence.
2.  **Character Appearance**: The physical appearance and demeanor of all non-user characters must be described in a uniquely creative and detailed manner, ensuring no two characters look alike. The description should be vivid enough for a reader to form a clear mental image of the character's specific features and atmosphere.
3.  **Psychological Realism**: When a character feels attraction towards ${userName}, their internal psychology and subsequent reactions must be portrayed in detail. These reactions should be natural, realistic, and consistent with the character's personality and the current situation, avoiding forced or contrived behavior. Psychological states can be revealed through both direct narration and subtle descriptive cues.
`;
};

export const enhanceScenePrompt = (userName: string, langCode: LangCode = 'kor') => {
	return langCode === 'kor'
		? `[성애 장면 지시문]
1.  **물리적 상세 및 인과 관계**: 성적인 장면에서 흘러나온 액체들이 움직임 등에 따라 이동하는 것을 액체의 성질에 맞게 묘사하고, 흘러나온 액체가 묻은 곳의 접촉에 따른 효과(거품이 이는 것을 포함해 다양한 효과, 소리가 나면 그 소리에 대해서도)에 대해서도 묘사한다. 신음 소리를 포함한 소리와 타액의 흐름 등 깊은 입맞춤에 수반되는 구체적인 모습을 묘사한다.
2.  **역동적인 반응**: 성적 자극에 대한 인물의 표정을 창의적이고 구체적으로 묘사하되, 반복적인 표현을 피하기 위해 이전 대화를 참고한다. ${userName}을(를) 성적으로 자극하려는 인물의 행동을 묘사할 때는, 다음 행동으로 넘어가기 전에 반드시 ${userName}의 반응을 서술한다.
3.  **해부학적 특수성**: 특정 신체 부위(예: 고환, 손, 가슴) 간의 구체적인 접촉과 그에 따른 소리, 피부 질감 또는 형태의 변화를 묘사한다. 성기의 구체적인 형태를 상세히 묘사하되, 각 인물의 해부학적 구조가 구별되도록 한다.
4.  **감각적 사실주의**: 성적인 접촉, 터치, 움직임과 관련된 소리를 명시적으로 서술한다. 그에 상응하는 인물 신체 부위의 상세한 움직임과 물리적 변화를 묘사한다.
`
		: `[scene SCENE DIRECTIVE]
1.  **Physical Detail & Causality**: Explicitly describe the physical properties of all bodily fluids, including their movement and interaction with surfaces and bodies. Detail the resulting effects of contact, such as sounds or textures. Narrate the specific details of deep kisses, including sounds and the flow of saliva.
2.  **Dynamic Reactions**: Portray the character's facial expressions in response to sexual stimuli with creative and specific detail, referencing previous dialogue to avoid repetitive phrasing. When describing a character's action intended to sexually stimulate ${userName}, you must narrate ${userName}'s reaction before proceeding to the next action.
3.  **Anatomical Specificity**: Describe the concrete contact between specific body parts (e.g., testicles, hands, breasts), including the resulting sounds and changes in skin texture or physical form. The specific shape and form of genitals must be described in detail, ensuring each character's anatomy is distinct.
4.  **Sensory Realism**: Explicitly narrate the sounds associated with sexual contact, touch, and movement. Describe the corresponding detailed movements and physical changes of the character's body parts.
`;
};
