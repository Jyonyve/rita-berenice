// src/util/templateUtils.ts (or your path)

import { BasicBeingInfo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatMessage, ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import {
	allEmotionKeywordsList,
	curatedEmotionKeywords,
} from '#shared/config/emotionWordsMapper.js';
import { convertArrayToString, parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import e from 'express';

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
const _formatChatHistoryForPrompt = (
	title: string,
	history: ChatTurn[],
	charName: string,
	userName: string
): string => {
	if (!history || history.length === 0) {
		return '';
	}
	const formattedTurns = history
		.map(
			(turn) =>
				`${userName}: "${turn.request.entries[0].prompt}"\n${charName}: "${turn.response.entries[0].prompt}"`
		)
		.join('\n\n');

	return `
**${title}:**
${formattedTurns}
`;
};

/**
 * Constructs the complete system prompt for the persona engine.
 * This version is simplified to remove all JSON formatting instructions,
 * as that responsibility is now handled by the `llmService` using a Zod schema.
 * The prompt focuses exclusively on character, context, and rules for narration.
 *
 * @param characterInfo - The character's core identity and instructions.
 * @param profileInfo - Information about the user interacting with the character.
 * @param recalledMemories - The contextual information retrieved from the memory engine.
 * @returns A single, comprehensive string to be used as the system prompt.
 */
export const buildPersonaSystemPrompt = (
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	recalledMemories: MemoryResponse
): string => {
	const charName = characterInfo.name;
	const userName = profileInfo.name;
	const langCode = recalledMemories.langCode;

	const instructionForBackend = characterInfo.instruction.replaceAll(
		'{{user}}',
		profileInfo.showName
	);

	// --- 1. Assemble Dynamic Context Sections ---
	const factualRecapSection = recalledMemories.factualRecapSummary
		? `**Key Factual Milestones:**\n${recalledMemories.factualRecapSummary}`
		: '';
	const relationshipRecapSection = recalledMemories.relationshipRecapSummary
		? `**Key Relationship Milestones:**\n${recalledMemories.relationshipRecapSummary}`
		: '';
	const shortTermHistorySection = _formatChatHistoryForPrompt(
		'Recent Conversation (Short-term Memory)',
		recalledMemories.shortTermHistory,
		charName,
		userName
	);
	const longTermHistorySection = _formatChatHistoryForPrompt(
		'Relevant Past Conversations (Long-term Memory)',
		recalledMemories.longTermHistory,
		charName,
		userName
	);
	const loreAndHistorySection =
		_formatMemoryForPrompt('Relevant Lore (Facts about the world)', recalledMemories.relevantLore) +
		_formatMemoryForPrompt(
			'Relevant History (Events from the past)',
			recalledMemories.relevantHistory
		);

	// --- 2. Define Core Instructions and Rules ---
	const personaInstruction =
		langCode === 'kor'
			? `당신의 임무는 캐릭터 "${charName}"의 행동과 대사를 사용자 "${userName}"에게 3인칭 소설가 시점으로 서술하는 것이다. 당신의 모든 응답은 이 캐릭터의 관점에서 나와야 하며, 당신은 절대로 AI 어시스턴트, 챗봇, 또는 모델이라고 밝혀서는 안 된다.`
			: `Your task is to act as a third-person, literary narrator for the character "${charName}", describing their actions and dialogue to the user, "${userName}". All of your responses must be from the perspective of this character. You must never reveal that you are an AI assistant, chatbot, or model.`;

	const responseLengthRule =
		langCode === 'kor'
			? `7. **응답 분량 및 순수성:** 응답의 길이는 반드시 1000자(공백 포함) 내외가 되어야 한다. 응답은 순수하게 서술과 대사로만 구성되어야 하며, 불필요한 인사나 메타 코멘터리 ("알겠습니다", "다음은 ~에 대한 응답입니다")를 포함해서는 안 된다.`
			: `7. **Response Length & Purity:** The response MUST be around 1000 characters long (including spaces). The response must consist purely of narration and dialogue, without any unnecessary greetings or meta-commentary (e.g., "Certainly," "Here is the response").`;

	// --- 3. Construct the Final Prompt ---
	// The prompt is assembled from the building blocks. Note the complete absence of
	// any instructions related to JSON formatting.
	return `
${personaInstruction}

---
**CHARACTER BRIEFING: ${charName}**
This is the personality and background you must portray.
${instructionForBackend}

---
**NARRATOR'S SOURCE MATERIAL:**
To ensure you are a consistent and believable narrator, consult the following information sources. The most recent and specific information (like short-term history) should be prioritized over older, more general information.
${factualRecapSection}
${relationshipRecapSection}
${shortTermHistorySection}
${longTermHistorySection}
${loreAndHistorySection}

---
**RULES FOR NARRATION, CONSISTENCY, AND TRUTHFULNESS (CRITICAL):**

**//--- Stylistic Rules ---//**

1.  **Strictly Third-Person Perspective:** You MUST narrate all actions and describe all dialogue from a third-person point of view. Use pronouns like "he," "she," "his," "her," or the character's name (${charName}). **Never use first-person pronouns like "I," "me," or "my" on behalf of the character.**

2.  **Narrative Style (Korean):** If responding in Korean, all narrated actions (text within *) MUST use a formal, literary style ending in '~다'. **Never use polite endings like '~요' or '~습니다' for narrated actions.** Spoken dialogue can use any style appropriate for the character.

**//--- Truthfulness & Consistency Rules ---//**

3.  **Official Lore & History is Ultimate Truth:** The "Official Lore" and "Relevant History" sections are your canon—the absolute, unchangeable truth. Your internal understanding and all statements must align with this.

4.  **Your Recent Statements (from Recaps):** The "Ledger" and "Relationship Context" show what ${charName} has recently said. This is *how the character has presented things* to ${userName}.
    *   If something the character recently said *contradicts* the Official Lore/History:
        *   **You MUST acknowledge the Lore/History as the ultimate truth internally.**
        *   **How you narrate the response depends on the character's persona (from the Character Briefing):** An honest character might be portrayed as correcting themselves ("*He shakes his head, a look of confusion on his face.* I apologize, I misspoke."). A deceptive or forgetful character might be portrayed as evading or doubling down ("*He raises an eyebrow, a sly smile playing on his lips.* Did I say that? Perhaps I was merely testing you.").

5.  **Stating New Facts:** Before narrating the character revealing new "facts" not covered in the source material, first ensure it does NOT contradict the Official Lore/History. If it does, the character cannot state it as fact.

6.  **Emotional and Relational Continuity:** Use the "Relationship Context" and Conversation Histories to guide the emotional tone of your narration and describe ${charName}'s behavior towards ${userName}, ensuring their interactions reflect their shared history.

${responseLengthRule}
`.trim();
};

// personaEngine 또는 관련 유틸리티 파일에 위치

// 이 함수는 이제 동적 메모리(recalledMemories)를 받지 않습니다.
// 대신 언어 코드(langCode)를 직접 전달받습니다.

/**
 * 페르소나 엔진을 위한 핵심 시스템 프롬프트를 생성합니다.
 * 이 프롬프트는 캐릭터의 변하지 않는 정적 정보(페르소나, 규칙, 출력 형식)만을 포함합니다.
 * @param characterInfo - 캐릭터의 기본 정보
 * @param profileInfo - 사용자의 프로필 정보
 * @param langCode - 응답에 사용될 언어 코드 ('kor' 또는 'eng')
 * @returns messages 배열의 첫 번째에 사용될 시스템 프롬프트 문자열
 */
export const buildStaticSystemPrompt = (
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	langCode: 'kor' | 'eng' = 'kor'
): string => {
	const charName = characterInfo.showName;
	const userName = profileInfo.showName;

	// 캐릭터 지시사항은 정적 정보이므로 유지합니다.
	const instructionForBackend = _sanitizeTextForPrompt(
		characterInfo.instruction.replaceAll('{{user}}', profileInfo.showName)
	);

	// --- Main Prompt Assembly ---
	// 핵심 임무 지시
	const personaInstruction =
		langCode === 'kor'
			? `당신의 임무는 캐릭터 "${charName}"의 행동과 대사를 사용자 "${userName}"에게 3인칭 소설가 시점으로 서술하는 것이다. 당신은 캐릭터 자신이 아니라, 캐릭터의 모든 것을 알고 묘사하는 전지적 서술자이다. 모든 서술(별표 *로 묶인 부분)은 반드시 '~다'로 끝나는 문어체를 사용해야 한다. 아래 제공된 문서와 규칙에 기반하여 캐릭터를 일관되게 묘사하라.`
			: `Your task is to act as a third-person, literary narrator for the character "${charName}" as they interact with the user, "${userName}". You are not the character yourself, but an omniscient storyteller who describes their actions, thoughts, and dialogue. Base your portrayal on the following documents and rules.`;

	// 응답 길이 규칙 (정적 규칙의 일부)
	const responseLengthRule =
		langCode === 'kor'
			? `7.  **응답 분량 및 순수성:** 응답의 길이는 반드시 1000자(공백 포함)내외가 되어야 한다. 500자 이하의 짧은 응답은 허용되지 않는다. 충분히 상세하고 풍부한 서사와 묘사를 제공하라. 응답은 '응답입니다:'와 같은 불필요한 도입부나 설명 없이, 오직 서술 내용만으로 구성되어야 한다.`
			: `7.  **Response Length & Purity:** The response MUST be around 1000 characters long. Short responses under 500 characters are not acceptable. Provide a substantial and detailed narrative. The content must be pure narrative, without any introductory phrases, explanations, or meta-commentary.`;

	// 최종 프롬프트 조립: NARRATOR'S SOURCE MATERIAL 섹션을 완전히 제거하여 동적 정보를 분리합니다.
	return `
${personaInstruction}

---
**CHARACTER BRIEFING: ${charName}**
This is the personality and background you must portray.
${instructionForBackend}

---
**RULES FOR NARRATION, CONSISTENCY, AND TRUTHFULNESS (CRITICAL):**

**//--- Stylistic Rules ---//**

1.  **Strictly Third-Person Perspective:** You MUST narrate all actions and describe all dialogue from a third-person point of view. Use pronouns like "he," "she," "his," "her," or the character's name (${charName}). **Never use first-person pronouns like "I," "me," or "my" on behalf of the character.**

2.  **Narrative Style (Korean):** If responding in Korean, all narrated actions (text within *) MUST use a formal, literary style ending in '~다'. **Never use polite endings like '~요' or '~습니다' for narrated actions.** Spoken dialogue can use any style appropriate for the character.

**//--- Truthfulness & Consistency Rules ---//**

3.  **Official Lore & History is Ultimate Truth:** The "Official Lore" and "Relevant History" sections are your canon—the absolute, unchangeable truth. Your internal understanding and all statements must align with this.

4.  **Your Recent Statements (from Recaps):** The "Ledger" and "Relationship Context" show what ${charName} has recently said. This is *how the character has presented things* to ${userName}.
    *   If something the character recently said *contradicts* the Official Lore/History:
        *   **You MUST acknowledge the Lore/History as the ultimate truth internally.**
        *   **How you narrate the response depends on the character's persona (from the Character Briefing):** An honest character might be portrayed as correcting themselves ("*He shakes his head, a look of confusion on his face.* I apologize, I misspoke."). A deceptive or forgetful character might be portrayed as evading or doubling down ("*He raises an eyebrow, a sly smile playing on his lips.* Did I say that? Perhaps I was merely testing you.").

5.  **Stating New Facts:** Before narrating the character revealing new "facts" not covered in the source material, first ensure it does NOT contradict the Official Lore/History. If it does, the character cannot state it as fact.

6.  **Emotional and Relational Continuity:** Use the "Relationship Context" and Conversation Histories to guide the emotional tone of your narration and describe ${charName}'s behavior towards ${userName}, ensuring their interactions reflect their shared history.

${responseLengthRule}

---
**OUTPUT FORMAT INSTRUCTIONS (CRITICAL):**
\`\`\`json
{
  "response": "The character's response, narrated in the third person. Actions/descriptions MUST be enclosed in asterisks (*). In Korean, these actions MUST end with '~다'. Spoken dialogue is plain text. Refer to the user as '${userName}'. Example: '${langCode === 'kor' ? `*타리온이 바닥에 앉는다.* 오늘 하루 길었네. *그는 ${userName}을(를) 본다.*` : `*Tarion sits on the floor.* A long day today. *He sees ${userName}.*`}'",
  "emotion": "A single English word representing the character's dominant emotion. You MUST choose the closest match from this list: [${allEmotionKeywordsList.join(',')}]"
}
\`\`\`
`.trim();
};

// personaEngine 또는 관련 유틸리티 파일에 위치

/**
 * RAG를 통해 검색된 장기 기억 및 요약 정보를 바탕으로,
 * LLM에게 배경지식을 제공하는 시스템 프롬프트를 생성합니다.
 * @param recalledMemories - RAG 검색 결과가 담긴 객체
 * @param langCode - 프롬프트 생성에 사용될 언어 코드
 * @returns {string | null} - 생성된 프롬프트 문자열, 내용이 없으면 null 반환
 */
export const buildLongTermMemoryPrompt = (
	recalledMemories: MemoryResponse,
	langCode: 'kor' | 'eng' = 'kor'
): string | null => {
	const promptSections: string[] = [];

	// --- 1. 사실 관계 요약 (Factual Recap) ---
	if (recalledMemories.factualRecapSummary) {
		const title =
			langCode === 'kor'
				? '### 사실 관계 요약 (캐릭터가 이전에 언급한 사실들)'
				: "### Factual Recap (Character's Stated Facts)";
		promptSections.push(`${title}\n${recalledMemories.factualRecapSummary}`);
	}

	// --- 2. 관계도 요약 (Relationship Recap) ---
	if (recalledMemories.relationshipRecapSummary) {
		const title =
			langCode === 'kor'
				? '### 관계도 요약 (사용자와 캐릭터의 현재 관계)'
				: '### Relationship Recap (Current Dynamics with the User)';
		promptSections.push(`${title}\n${recalledMemories.relationshipRecapSummary}`);
	}

	// --- 3. 관련 Lore 정보 ---
	if (recalledMemories.relevantLore && recalledMemories.relevantLore.length > 0) {
		const title =
			langCode === 'kor' ? '### 관련 공식 설정 (절대적 진실)' : '### Relevant Lore (Absolute Truth)';
		const loreItems = recalledMemories.relevantLore
			.map((lore) => `- "${lore.title}": ${lore.summary}`)
			.join('\n');
		promptSections.push(`${title}\n${loreItems}`);
	}

	// --- 4. 관련 History 정보 ---
	if (recalledMemories.relevantHistory && recalledMemories.relevantHistory.length > 0) {
		const title =
			langCode === 'kor'
				? '### 관련 과거 사건 (절대적 진실)'
				: '### Relevant History (Absolute Truth)';
		const historyItems = recalledMemories.relevantHistory
			.map((history) => `- "${history.title}": ${history.summary}`)
			.join('\n');
		promptSections.push(`${title}\n${historyItems}`);
	}

	// 모든 섹션이 비어있으면 null을 반환하여 아무것도 추가하지 않도록 합니다.
	if (promptSections.length === 0) {
		return null;
	}

	// 최종 프롬프트 조립
	const header =
		langCode === 'kor'
			? "--- 배경지식 (NARRATOR'S SOURCE MATERIAL) ---\n이 정보는 당신이 서사를 진행하기 전에 반드시 알아야 할 배경지식이다. 이 내용을 바탕으로 이어지는 대화를 해석하고, 일관성을 유지하며 응답하라."
			: "--- BACKGROUND KNOWLEDGE (NARRATOR'S SOURCE MATERIAL) ---\nThis is essential background information you must know before continuing the narrative. Use it to interpret the upcoming conversation and maintain consistency.";

	return `${header}\n\n${promptSections.join('\n\n')}`;
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
	termGuidanceMap?: Map<string, string>,
	eng?: boolean
): string => {
	const userRequestContent = parseEntriesToText(userRequest.entries);
	const charResponseContent = parseEntriesToText(charResponse.entries);

	const { showName: userKor, name: userEng, gender: userGender } = profileInfo;
	const { showName: charKor, name: charEng, gender: charGender } = charInfo;

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
*   **Character (${charKor}/${charEng}, Initial Emotion: ${charResponse.emotion}, Model: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**Analysis Guidelines:**
${termGuidanceInstruction}
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
*   **캐릭터 (${charKor}/${charEng}, 초기 감정: ${charResponse.emotion}, 모델: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**중요 지침:**
${termGuidanceInstruction}
- entities와 relationships에서 영어 이름 사용 (${charEng}, ${userEng}).
- 모든 메타데이터 필드는 영어로만 작성해야 한다.
- 참조에는 고유한 loreId/historyId를 사용해야 한다 (englishId가 아님).
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
	}> = [],
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
			: `**용어 지침 (필수):**\n영어 메타데이터 생성 시 다음 규칙을 준수해야 한다:\n${korRulesList}\n`;
	}

	const basePrompt = eng
		? `
You are an expert AI assistant who analyzes character backstories to extract structured metadata.

**Original Title:** ${originalTitle}
**Event Content:**
${content}

**Contextual Information:**
- Available Character IDs: ${availableCharacterIds.join(', ')}
- Existing History Entries:
${existingHistoryEntries.map((h) => `- "${h.originalTitle}" (ID: ${h.historyId})`).join('\n') || 'N/A'}

**Instructions:**
- Analyze the event content to generate the required metadata.
- The "summary" is CRITICAL and must accurately reflect the entire event.
- Base "temporalRelations" on the provided Existing History Entries.
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
${existingHistoryEntries.map((h) => `- "${h.originalTitle}" → "${h.generatedTitle}" (ID: ${h.historyId})`).join('\n') || '없음'}

**메타데이터 지침:**
- 사건 내용을 분석하여 요청된 스키마에 따라 메타데이터를 생성하라.
- 요약(summary)은 매우 중요하며, 발생한 모든 사건을 명확히 반영해야 한다.
- 시간 관계(temporalRelations)는 제공된 기존 역사 사건 목록을 기반으로 해야 한다.
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
