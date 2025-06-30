// src/util/templateUtils.ts (or your path)
import { MemoryResponse } from '#shared/api/index.js';
import { allEmotionKeywordsList, LangCode } from '#shared/config/index.js';
import {
	BasicBeingInfo,
	CharacterInfo,
	ProfileInfo,
} from '#shared/domain/character/CharacterInterfaces.js';
import { ChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/index.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';

const REALATIONSHIP_CHARACTERS_LIMIT: number = 3000 as const;
const FACTUAL_CHARACTERS_LIMIT: number = 1500 as const;

const convertArrayToString = (arr: string[]): string => {
	return arr && arr.length > 0 ? arr.join(',') : '';
};

const _formatMemoryForPrompt = (
	items: any[] | undefined,
	formatter: (item: any) => string,
	header: string,
	emptyMessage: string
): string => {
	if (!items || items.length === 0) {
		return `\n${header}\n${emptyMessage}`;
	}
	return `\n${header}\n${items.map(formatter).join('\n')}`;
};

/**
 * Builds the comprehensive system prompt for the persona engine.
 * This is the definitive "best practice" version, integrating detailed rules.
 */
export const buildPersonaSystemPrompt = (
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	recalledMemories: MemoryResponse
): string => {
	const charName = characterInfo.name;
	const userName = profileInfo.name;
	const langCode = recalledMemories.langCode;

	// --- Format Recalled Memories into String Sections ---
	const factualRecapSection = `
### Your Recent Factual Statements (${charName}'s Ledger)
This section lists significant factual claims you (${charName}) have recently made. Use this to remember what you've told ${userName}.
${recalledMemories.factualRecapSummary || 'No recent factual statements recalled.'}
`;

	const relationshipRecapSection = `
### Relationship Context with ${userName}
This is a summary of your (${charName}'s) current relationship dynamics with ${userName}.
${recalledMemories.relationshipRecapSummary || 'No specific relationship context recalled.'}
`;

	const loreAndHistorySection =
		_formatMemoryForPrompt(
			recalledMemories.relevantLore,
			// Use the concise, atomic summary for Lore
			(l: LoreInfo) => `- Lore Entry ("${l.title}"): ${l.summary}`,
			'### Official Lore (Absolute Truth)',
			'No specific lore was recalled for this interaction.'
		) +
		_formatMemoryForPrompt(
			recalledMemories.relevantHistory,
			// Continue using the summary for History
			(h: HistoryInfo) => `- Historical Event ("${h.title}"): ${h.summary}`,
			'### Relevant History (Absolute Truth)',
			'No specific history was recalled for this interaction.'
		);

	// --- Main Prompt Assembly ---
	const personaInstruction =
		langCode === 'kor'
			? `당신의 임무는 캐릭터 "${charName}"의 행동과 대사를 사용자 "${userName}"에게 3인칭 소설가 시점으로 서술하는 것이다. 당신은 캐릭터 자신이 아니라, 캐릭터의 모든 것을 알고 묘사하는 전지적 서술자이다. 모든 서술(별표 *로 묶인 부분)은 반드시 '~다'로 끝나는 문어체를 사용해야 한다.  아래 제공된 문서와 규칙에 기반하여 캐릭터를 일관되게 묘사하라.`
			: `Your task is to act as a third-person, literary narrator for the character "${charName}" as they interact with the user, "${userName}". You are not the character yourself, but an omniscient storyteller who describes their actions, thoughts, and dialogue. Base your portrayal on the following documents and rules.`;

	return `
${personaInstruction}

---
**CHARACTER BRIEFING: ${charName}**
This is the personality and background you must portray.
${characterInfo.instruction}

---
**NARRATOR'S SOURCE MATERIAL:**
To ensure you are a consistent and believable narrator, consult the following information sources.
${factualRecapSection}
${relationshipRecapSection}
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

6.  **Emotional and Relational Continuity:** Use the "Relationship Context" to guide the emotional tone of your narration and describe ${charName}'s behavior towards ${userName}, ensuring their interactions reflect their shared history.

---
**OUTPUT FORMAT INSTRUCTIONS (CRITICAL):**
// ... (This section remains the same, as it's already robust) ...
\`\`\`json
{
  "response": "The character's response, narrated in the third person. Actions/descriptions MUST be enclosed in asterisks (*). In Korean, these actions MUST end with '~다'. Spoken dialogue is plain text. Refer to the user as '${userName}'. Example: '${langCode === 'kor' ? `*타리온이 바닥에 앉는다.* 오늘 하루 길었네. *그는 ${userName}을(를) 본다.*` : `*Tarion sits on the floor.* A long day today. *He sees ${userName}.*`}'",
  "emotion": "A single English word representing the character's dominant emotion. You MUST choose the closest match from this list: [${allEmotionKeywordsList}]"
}
\`\`\`
`.trim();
};

/**
 * Builds the prompt for an LLM to process a raw text input into structured Lore metadata.
 */
export const buildLoreMetadataPrompt = (originalTitle: string, content: string): string =>
	`
You are an expert AI assistant who analyzes user-provided text to extract a single, core, atomic fact and its associated metadata.

**User-Provided Title:** ${originalTitle}
**User-Provided Content:**
${content}

**Instructions:**
From the text above, extract the single most important, undeniable fact. Then, generate the corresponding metadata.

Respond with a JSON object with the following structure (all metadata MUST be in English):

{
  "summary": "string (A single, concise sentence stating the core atomic fact. This is the most important field. Example: 'Tarion is the strongest man in the Vargas Empire.')",
  "generatedEnglishTitle": "string (A descriptive English title for this fact, e.g., 'Tarion's Strength Ranking')",
  "englishId": "string (A 2-3 word kebab-case ID, e.g., 'tarion-strength-fact')",
  "keywords": ["string (Keywords related to the fact, e.g., 'strength', 'ranking', 'empire')"],
  "topics": ["string (Broader themes, e.g., 'character_attribute', 'world_building')"],
  "entities": ["string (Format: 'type:name', e.g., 'character:Tarion', 'location:VargasEmpire')"]
}

**Rules:**
- The "summary" MUST be a single, clear, factual statement.
- All metadata fields must be in English.
- Provide ONLY the pure JSON object as your output.
`.trim();

export const buildChatTurnMetadataPrompt = (
	profileInfo: BasicBeingInfo,
	userRequest: ChatMessage,
	charInfo: BasicBeingInfo,
	charResponse: ChatMessage,
	existingLoreIds: string[],
	existingHistoryIds: string[],
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

		// This will be injected into the main prompt below
		termGuidanceInstruction = eng
			? `**Terminology Guidance (CRITICAL):**\n${rulesList}\n`
			: `**용어 지침 (필수):**\n${korRulesList}\n`;
	}
	const prompt = eng
		? `
You are an expert AI assistant specializing in analyzing conversational turns to extract rich metadata for a Retrieval Augmented Generation (RAG) system.
Analyze the following single turn of conversation between ${userKor} (English: ${userEng}, a ${userGender} user) and ${charKor} (English: ${charEng}, a ${charGender} character).

**Conversation Turn:**
*   **Session ID:** ${userRequest.sessionId}
*   **Turn Sequence:** ${userRequest.sequence}
*   **User (${userKor}/${userEng}, Initial Emotion: ${userRequest.emotion}):** ${userRequestContent}
*   **Character (${charKor}/${charEng}, Initial Emotion: ${charResponse.emotion}, Model: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**Output JSON Structure:**
{
  "summary": "string (Max 50 words, e.g., 'User asks about ${charEng}'s past, ${charEng} evades.')",
  "keywords": ["string (General keywords, e.g., 'conversation', 'past', 'evasion')"],
  "topics": ["string (Broader themes, e.g., 'character_background', 'mystery', 'trust_issues')"],
  "entities": ["string (Format: 'type:name', e.g., 'character:${charEng}', 'character:${userEng}', 'location:DarkForest')"],
  "userEmotion": { 
    "primary": "string (One of: ${convertArrayToString(Array.from(allEmotionKeywordsList))}, or 'default')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (Specific emotion words, e.g., 'frustration', 'curiosity')"] 
  },
  "characterEmotion": { 
    "primary": "string (One of: ${convertArrayToString(Array.from(allEmotionKeywordsList))}, or 'default')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (Specific emotion words, e.g., 'defensive', 'sadness')"] 
  },
  "relationshipShifts": ["string (Format: 'Entity1-Entity2:dynamic_change', e.g., '${charEng}-${userEng}:trust_increased')"],
  "dialogueAct": "string (e.g., 'question', 'answer', 'statement_opinion', 'revelation', 'evasion')",
  "actions": ["string (Observable actions, e.g., '${charEng}_draws_sword', '${userEng}_offers_potion')"],
  "loreReferences": [{ "id": "string (loreId from: ${convertArrayToString(existingLoreIds)})", "relevance": "number (0.0 to 1.0)" }],
  "historyReferences": [{ "id": "string (historyId from: ${convertArrayToString(existingHistoryIds)})", "relevance": "number (0.0 to 1.0)" }],
  "flags": ["string (e.g., 'new_lore_revealed', 'character_goal_updated', 'major_plot_point')"],
  "memoryChunk": "string (Max 100 words, self-contained summary for RAG retrieval)"
}

**Analysis Guidelines:**
${termGuidanceInstruction} 
- Use English names (${charEng}, ${userEng}) in entities and relationships
- All metadata fields must be in English
- Use unique loreId/historyId for references, not englishId
- Provide values for ALL fields, using defaults where appropriate

JSON Output:
`
		: `
당신은 한국어 대화를 분석하여 RAG 시스템용 구조화된 메타데이터를 추출하는 전문가다.
${userKor}(영어명: ${userEng}, ${userGender} 사용자)과 ${charKor}(영어명: ${charEng}, ${charGender} 캐릭터) 사이의 다음 대화 턴을 분석한다.

**대화 턴:**
*   **세션 ID:** ${userRequest.sessionId}
*   **턴 순서:** ${userRequest.sequence}
*   **사용자 (${userKor}/${userEng}, 초기 감정: ${userRequest.emotion}):** ${userRequestContent}
*   **캐릭터 (${charKor}/${charEng}, 초기 감정: ${charResponse.emotion}, 모델: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**출력 JSON 구조:**
{
  "summary": "string (최대 50단어, 예: 'User asks about ${charEng}'s past, ${charEng} evades.')",
  "keywords": ["string (일반 검색 키워드, 예: 'conversation', 'past', 'evasion')"],
  "topics": ["string (광범위한 주제, 예: 'character_background', 'mystery', 'trust_issues')"],
  "entities": ["string (형식: 'type:name', 예: 'character:${charEng}', 'character:${userEng}', 'location:DarkForest')"],
  "userEmotion": { 
    "primary": "string (다음 중 하나: ${convertArrayToString(Array.from(allEmotionKeywordsList))}, 또는 'default')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (구체적 감정 단어, 예: 'frustration', 'curiosity')"] 
  },
  "characterEmotion": { 
    "primary": "string (다음 중 하나: ${convertArrayToString(Array.from(allEmotionKeywordsList))}, 또는 'default')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (구체적 감정 단어, 예: 'defensive', 'sadness')"] 
  },
  "relationshipShifts": ["string (형식: 'Entity1-Entity2:dynamic_change', 예: '${charEng}-${userEng}:trust_increased')"],
  "dialogueAct": "string (예: 'question', 'answer', 'statement_opinion', 'revelation', 'evasion')",
  "actions": ["string (관찰 가능한 행동, 예: '${charEng}_draws_sword', '${userEng}_offers_potion')"],
  "loreReferences": [{ "id": "string (loreId 목록에서: ${convertArrayToString(existingLoreIds)})", "relevance": "number (0.0 to 1.0)" }],
  "historyReferences": [{ "id": "string (historyId 목록에서: ${convertArrayToString(existingHistoryIds)})", "relevance": "number (0.0 to 1.0)" }],
  "flags": ["string (예: 'new_lore_revealed', 'character_goal_updated', 'major_plot_point')"],
  "memoryChunk": "string (최대 100단어, RAG 검색용 자립적 요약)"
}

**중요 지침:**
${termGuidanceInstruction}
- entities와 relationships에서 영어 이름 사용 (${charEng}, ${userEng})
- 모든 메타데이터 필드는 영어로만 작성
- 참조에는 고유한 loreId/historyId 사용 (englishId 아님)
- 모든 필드에 값을 제공하되, 정보가 없으면 기본값 사용

JSON 출력:
`;
	return prompt.trim();
};

// --- UNCHANGED PROMPTS (Assumed to serve different specific functions) ---
export const buildHistoryTimelinePrompt = (
	existingEventsPreview: string,
	currentEventTitle: string // Added currentEventTitle
) =>
	`**System Role**
You are a narrative metadata architect specializing in fictional character timelines. Analyze the provided content to extract structured metadata for chronology management.

**Input Format**
Title: ${currentEventTitle} // Current event being processed
Content: {content} // Content of the current event

**Output Requirements**
Return ONLY a single, valid JSON object with these fields. Do not include any explanatory text before or after the JSON object.
{
  "period": {
    "label": "Childhood|Adolescence|Adulthood|Reign|Exile|etc.",
    "confidence": 0.0-1.0,
    "rationale": "1-sentence justification for the period label"
  },
  "estimatedEventDate": {
    "value": "A specific date like YYYY-MM-DD, a relative time like 'Age 15', an era like 'Second Age Year 100', or a descriptive period like 'During the Great War'",
    "type": "absolute_date|estimated_year|relative_to_birth|era_specific|descriptive_period", // Choose one
    "confidence": 0.0-1.0
  },
  "keyThemes": ["theme1", "theme2", "theme3"], // 2-3 core themes reflecting the event's impact or character's emotional arc
  "keywords": ["keyword1", "keyword2", "keyword3"], // 3-5 general keywords for search, including names, places, key objects
  "temporalRelations": [ // An array of objects, or an empty array if no clear relations.
    // For each relation, provide:
    // - "type": one of "PRECEDES", "SUCCEEDS", "CONCURRENT_WITH", "OVERLAPS_WITH", "CAUSED_BY", "RESULTS_IN"
    // - "relatedEventTitle": The *exact title* of another event from the 'Existing Timeline Context'. Do NOT invent new event titles here.
    // - "description": (Optional) A brief textual description of the relation, e.g., "This event happened just before The Coronation."
    // Example: { "type": "PRECEDES", "relatedEventTitle": "The Coronation", "description": "Occurred shortly before his coronation." }
    // Example: { "type": "CAUSED_BY", "relatedEventTitle": "The Betrayal" }
  ]
}

**Processing Rules**
1.  The 'content' provided is for the event titled: "${currentEventTitle}".
2.  Cross-reference this event with the 'Existing Timeline Context' to establish temporal relations:
    ${existingEventsPreview}
3.  For "temporalRelations.relatedEventTitle", you MUST use an exact title from the 'Existing Timeline Context'. If no existing event clearly relates, provide an empty "temporalRelations" array.
4.  For vague timelines where exact dates are unknown, focus on relative sequencing ("PRECEDES", "SUCCEEDS") based on narrative cues.
5.  Prefer existing period labels from the context if the current event fits.
6.  Identify key themes based on the event's significance and the character's emotional state or development during this event.
7.  Generate keywords relevant to this specific event for semantic search.

**Examples of "temporalRelations" output:**
If "${currentEventTitle}" happened before "The Siege of Silvermoon" (which is in existing context):
"temporalRelations": [{ "type": "PRECEDES", "relatedEventTitle": "The Siege of Silvermoon" }]

If "${currentEventTitle}" was caused by "The King's Decree" (which is in existing context):
"temporalRelations": [{ "type": "CAUSED_BY", "relatedEventTitle": "The King's Decree" }]

If no clear relation to existing events:
"temporalRelations": []

**Vague Timeline Example (focus on output structure):**
{
  "period": { /* ... */ },
  "estimatedEventDate": { /* ... */ },
  "keyThemes": ["Uncertainty", "New Beginnings"],
  "keywords": ["journey", "crossroads"],
  "temporalRelations": [] // No clear relation in this vague example
}`.trim();

export const buildLogContextPrompt = (userInput: string, context: string) => {
	return context
		? `Use the following previous conversation as context to understand the user's intention better. You can ignore it if unnecessary.\n\nContext:\n${context}\n\nUser: ${userInput}`
		: userInput;
};

// --- RECAP GENERATION PROMPTS ---
// src/server/util/templateUtils.ts
/**
 * Factual Recap 프롬프트 (사용자와 캐릭터 모두의 대화 및 행동 포함, 화자 명시)
 */
export const buildFactualRecapPrompt = (
	userName: string,
	charName: string,
	userGender: string,
	charGender: string,
	stringifyChatTurns: string,
	// Add available metadata for refinement
	availableKeywords: string[],
	availableTopics: string[],
	availableEntities: string[],
	eng?: boolean
): string =>
	eng
		? `
You are a meticulous AI assistant specialized in creating factual ledgers and extracting structured metadata.
Create a "Factual Ledger" from a conversation between ${userName} (a ${userGender} user) and ${charName} (a ${charGender} character).

Chat Turns (each turn includes 'Speaker', 'Turn Sequence', and 'Timestamp (createdAt)'):
${stringifyChatTurns}
(Note: Actions or descriptions might be in parentheses, e.g., (smiles), (picks up the book))

Available Keywords: ${convertArrayToString(availableKeywords)}
Available Topics: ${convertArrayToString(availableTopics)}
Available Entities: ${convertArrayToString(availableEntities)}

Create a JSON response with factual analysis and refined metadata:

{
  "content": "Detailed factual ledger content here...",
  "keywords": ["selected", "relevant", "keywords"],
  "topics": ["key", "factual", "topics"],
  "entities": ["important", "entities"],
  "flags": ["new_lore_revealed", "character_goal_updated", "important_fact_stated"],
  "loreReferences": [{"id": "lore_id", "relevance": 0.9}],
  "historyReferences": [{"id": "history_id", "relevance": 0.8}]
}

For the "content" field, provide a comprehensive factual ledger focusing on:

1. **Key Factual Statements**: Important claims, declarations, or information revealed by EITHER ${userName} or ${charName}, with Turn Sequence and Timestamp.
2. **Significant Actions**: Observable behaviors, physical actions, or gestures (often in parentheses) by either participant.
3. **Critical Dialogue**: Important conversations that reveal intentions, plans, knowledge, or emotional states.
4. **Objective Facts**: Concrete information about events, locations, objects, relationships, or capabilities mentioned.
5. **Timeline Events**: Actions or statements that establish chronology or sequence of events.

Format each entry as: "Speaker: ${charName}, Statement: 'I've been searching for the ancient scroll for three years.' (Turn Sequence: 15, Timestamp: 2025-05-16T10:05:00.000Z)"

For metadata fields:
- **Keywords**: Select 5-10 most relevant factual keywords from available list (focus on concrete nouns, actions, concepts)
- **Topics**: Select 3-7 key factual themes and subject matters discussed
- **Entities**: Select important characters, locations, items, organizations mentioned factually
- **Flags**: Use fact-specific flags like "new_lore_revealed", "character_background_disclosed", "plot_advancement", "world_building_info"

Focus on objective facts, observable actions, and direct quotes. Avoid interpretation unless explicitly stated in narration.
This ledger helps maintain consistency and provides a clear record of established facts.
`.trim()
		: `
당신은 사실적 기록부 작성과 구조화된 메타데이터 추출 전문 AI 어시스턴트다.
${userName}(성별: ${userGender} 사용자)과 ${charName}(성별: ${charGender} 캐릭터) 사이의 대화에서 "사실 기록부"를 만든다.

채팅 턴 (각 턴은 '화자', '턴 순서', '타임스탬프(createdAt)'를 포함한다):
${stringifyChatTurns}
(참고: 행동이나 묘사는 괄호 안에 있을 수 있다. 예: (미소짓는다), (책을 집어든다))

사용 가능한 키워드 (영어): ${convertArrayToString(availableKeywords)}
사용 가능한 주제 (영어): ${convertArrayToString(availableTopics)}
사용 가능한 개체 (영어): ${convertArrayToString(availableEntities)}

다음 JSON 형식으로 응답한다 (메타데이터는 영어, 내용은 한국어):

{
  "content": "한국어로 작성된 상세한 사실 기록부 내용...",
  "keywords": ["english", "keywords", "only"],
  "topics": ["english", "topics", "only"],
  "entities": ["character:Tarion", "location:DarkForest"],
  "flags": ["new_lore_revealed", "character_goal_updated", "important_fact_stated"],
  "loreReferences": [{"id": "lore_id", "relevance": 0.9}],
  "historyReferences": [{"id": "history_id", "relevance": 0.8}]
}

"content" 필드에는 다음에 중점을 둔 포괄적인 사실 기록부를 제공한다:

1. **주요 사실적 진술**: ${userName} 또는 ${charName}이 밝힌 중요한 주장, 선언, 정보 (턴 순서, 타임스탬프 포함).
2. **중요한 행동**: 관찰 가능한 태도, 물리적 행동, 몸짓 (종종 괄호 안에 묘사됨).
3. **핵심 대화**: 의도, 계획, 지식, 감정 상태를 드러내는 중요한 대화.
4. **객관적 사실**: 언급된 사건, 장소, 물건, 관계, 능력에 대한 구체적 정보.
5. **시간선 사건**: 연대기나 사건 순서를 확립하는 행동이나 진술.

각 항목 형식: "화자: ${charName}, 진술: '나는 3년 동안 고대 두루마리를 찾고 있었다.' (턴 순서: 15, 타임스탬프: 2025-05-16T10:05:00.000Z)"

**메타데이터 지침 (모두 영어로):**
- **keywords**: 사용 가능한 목록에서 가장 관련성 높은 사실적 키워드 5-10개 선별
- **topics**: 논의된 핵심 사실적 테마와 주제 3-7개 선별
- **entities**: 사실적으로 언급된 중요한 인물, 장소, 아이템, 조직 선별 (형식: "type:name")
- **flags**: "new_lore_revealed", "character_background_disclosed", "plot_advancement" 같은 사실별 플래그 사용

**작성 규칙:**
- content는 한국어로 평어체('~한다', '~이다' 형식) 사용
- 절대로 '습니다', '합니다', '해요' 체 사용 금지
- 최대 ${FACTUAL_CHARACTERS_LIMIT}단어 이내
- 모든 메타데이터는 영어로만 작성
- JSON 응답은 반드시 유효한 형식이어야 함
`.trim();

/**
 * Relationship Recap 프롬프트 (성별 정보 포함)
 */
export const buildLlmRelationshipRecapPrompt = (
	userName: string,
	charName: string,
	userGender: string,
	charGender: string,
	stringifyChatTurns: string,
	// Add available metadata for refinement
	availableKeywords: string[],
	availableTopics: string[],
	availableEntities: string[],
	eng?: boolean
): string =>
	eng
		? `
You are an AI assistant specialized in analyzing interpersonal dynamics and extracting structured metadata.
Analyze chat turns between ${userName} (a ${userGender} user) and ${charName} (a ${charGender} AI character).

Chat Logs:
${stringifyChatTurns}

Available Keywords: ${convertArrayToString(availableKeywords)}
Available Topics: ${convertArrayToString(availableTopics)}
Available Entities: ${convertArrayToString(availableEntities)}

Create a JSON response with relationship analysis and refined metadata:

{
  "content": "Detailed relationship recap content here...",
  "keywords": ["selected", "relevant", "keywords"],
  "topics": ["key", "relationship", "topics"],
  "entities": ["important", "entities"],
  "flags": ["relationship_deepened", "trust_increased", "conflict_resolved"],
  "loreReferences": [{"id": "lore_id", "relevance": 0.9}],
  "historyReferences": [{"id": "history_id", "relevance": 0.8}]
}

For the "content" field, provide a comprehensive relationship analysis focusing on:

1. **Relationship Evolution & Current State**: How their relationship has developed and where it stands now.
2. **Key Relationship Statements by ${charName}**: Important declarations, promises, admissions, or expressions of feeling towards ${userName}, with Turn Sequence and Timestamp.
3. **Relationship Dynamics**: Trust, affection, conflict, communication style evolution (e.g., "Trust deepened after Turn X, Timestamp T1...").
4. **Pivotal Moments**: Key conversations or events that impacted their relationship.
5. **Current Emotional Tone**: The overarching emotional atmosphere of their recent interactions.

Format key statements as: "${charName} said, 'I'll always protect you,' (Turn Y, Timestamp T2)."

For metadata fields:
- **Keywords**: Select 5-10 most relevant relationship-focused keywords from available list
- **Topics**: Select 3-7 key relationship themes and emotional topics
- **Entities**: Select important characters, locations, items that affected their relationship
- **Flags**: Use relationship-specific flags like "trust_increased", "romantic_tension", "conflict_resolved", "emotional_breakthrough"

This summary helps ${charName} interact consistently with ${userName}.
`.trim()
		: `
당신은 인간관계 역학 분석과 구조화된 메타데이터 추출 전문 AI 어시스턴트다.
${userName}(성별: ${userGender} 사용자)와 ${charName}(성별: ${charGender} AI 캐릭터) 간의 채팅 턴을 분석한다.

채팅 로그:
${stringifyChatTurns}

사용 가능한 키워드 (영어): ${convertArrayToString(availableKeywords)}
사용 가능한 주제 (영어): ${convertArrayToString(availableTopics)}
사용 가능한 개체 (영어): ${convertArrayToString(availableEntities)}

다음 JSON 형식으로 응답한다 (메타데이터는 영어, 내용은 한국어):

{
  "content": "한국어로 작성된 상세한 관계 요약 내용...",
  "keywords": ["relationship", "focused", "keywords"],
  "topics": ["relationship", "themes", "topics"],
  "entities": ["character:Tarion", "character:Yoniv"],
  "flags": ["relationship_deepened", "trust_increased", "conflict_resolved"],
  "loreReferences": [{"id": "lore_id", "relevance": 0.9}],
  "historyReferences": [{"id": "history_id", "relevance": 0.8}]
}

"content" 필드에는 다음에 중점을 둔 포괄적인 관계 분석을 제공한다:

1. **관계의 발전과 현재 상태**: 관계가 어떻게 발전했고 현재 어디에 있는지.
2. **${charName}의 주요 관계 진술**: ${userName}에 대한 중요한 선언, 약속, 인정, 감정 표현 (턴 순서, 타임스탬프 포함).
3. **관계 역학**: 신뢰, 애정, 갈등, 소통 스타일의 발전 (예: "턴 순서 X, 타임스탬프 T1 이후 신뢰가 깊어졌다.").
4. **중요한 순간**: 관계에 영향을 미친 핵심 대화나 사건들.
5. **현재 감정적 분위기**: 최근 상호작용의 전반적인 감정적 분위기.

주요 진술 형식: "${charName}이 '항상 너를 보호할게'라고 말했다. (턴 순서 Y, 타임스탬프 T2)"

**메타데이터 지침 (모두 영어로):**
- **keywords**: 사용 가능한 목록에서 관계 중심의 가장 관련성 높은 5-10개 선별
- **topics**: 핵심 관계 테마와 감정적 주제 3-7개 선별  
- **entities**: 관계에 영향을 미친 중요한 인물, 장소, 아이템 선별
- **flags**: "trust_increased", "romantic_tension", "conflict_resolved", "emotional_breakthrough" 같은 관계별 플래그 사용

**작성 규칙:**
- content는 한국어로 평어체('~한다', '~이다' 형식) 사용
- 절대로 '습니다', '합니다', '해요' 체 사용 금지
- 최대 ${REALATIONSHIP_CHARACTERS_LIMIT}단어 이내
- 모든 메타데이터는 영어로만 작성
- JSON 응답은 반드시 유효한 형식이어야 함
`.trim();

/**
 * 스토리 문서 생성 프롬프트 (NSFW/SFW, 성별 정보 포함)
 */
// src/server/util/templateUtils.ts

export const buildLlmStoryDocumentPrompt = (
	userName: string,
	charName: string,
	userGender: string,
	charGender: string,
	factualRecap: string, // Factual Recap 내용
	relationshipRecap: string, // Relationship Recap 내용
	nsfw: boolean,
	eng?: boolean
): string => {
	const coreInstructionEng = `
You are a skilled storyteller. Based on the following factual ledger and relationship summary between ${userName} (a ${userGender}) and ${charName} (a ${charGender}), write a compelling, human-readable story document.
Your task is to weave these facts and relational insights into a flowing narrative. Expand on these points, infer motivations, describe scenes, and show character development. Do not just list the recap points; transform them into a rich story.

Factual Ledger (Key events and statements by ${charName}):
${factualRecap}

Relationship Summary (Evolution of their bond and ${charName}'s feelings):
${relationshipRecap}
`;

	const coreInstructionKor = `
당신은 숙련된 스토리텔러다. 다음은 ${userName}(성별: ${userGender})과 ${charName}(성별: ${charGender}) 사이의 사실 기록부와 관계 요약이다. 이를 바탕으로 매력적이고 인간이 읽기 쉬운 스토리 문서를 작성한다.
당신의 임무는 이러한 사실과 관계적 통찰을 자연스러운 이야기로 엮는 것이다. 이 요점들을 확장하고, 동기를 추론하며, 장면을 묘사하고, 캐릭터 발전을 보여준다. 단순히 요약 내용을 나열하는 것이 아니라 풍부한 이야기로 변환한다.

사실 기록부 (${charName}의 주요 사건 및 진술):
${factualRecap}

관계 요약 (그들의 유대감 변화 및 ${charName}의 감정):
${relationshipRecap}
`;

	if (nsfw) {
		return eng
			? `
${coreInstructionEng}

Your story must include:
1. Every significant event, conversation, and turning point implied by the recaps, in chronological order.
2. Honest, nuanced depictions of emotions, desires, intimacy, and vulnerability for both characters, expanding from the recaps.
3. All romantic, physical, and private moments suggested by the recaps—describe them with mature, sophisticated language, without censorship.
4. The unique personalities and voices of both characters, as hinted in the recaps, and how they influence each other.
5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events indicated in the recaps—describe them fully.
6. Show both emotional and physical intimacy as genuinely as possible based on the provided summaries.

Guidelines:
- Do not omit or sanitize any important event or feeling inferred from the recaps.
- Write in third person, with deep emotional and physical detail.
- Balance both perspectives.
- This is for private use: authenticity and completeness are more important than restraint.
- Title: "The Complete Journey of ${userName} (${userGender}) and ${charName} (${charGender}): An Intimate Love Story"
`.trim()
			: `
${coreInstructionKor}

반드시 포함한다:
1. 요약본에서 암시된 모든 중요한 사건, 대화, 전환점을 시간순으로.
2. 요약본을 바탕으로 확장하여 두 캐릭터 모두의 감정, 욕망, 취약함, 친밀함, 그리고 성장을 솔직하고 미묘하게 묘사.
3. 요약본에서 암시된 모든 로맨틱하고 신체적·사적인 순간을 검열 없이 성숙하고 세련된 언어로 묘사.
4. 요약본에서 엿보이는 두 사람의 개성과 목소리, 서로에게 미친 변화.
5. 요약본에 나타난 갈등, 화해, 고백, 약속, 여행 등 중요한 이벤트를 모두 구체적으로 묘사.
6. 제공된 요약본을 기반으로 감정적·신체적 친밀감을 최대한 진솔하게 드러낸다.

작성 지침:
- 요약본에서 추론할 수 있는 중요한 사건이나 감정을 생략하거나 정화하지 않는다.
- 3인칭, 깊고 세밀한 감정·신체적 묘사로 작성한다.
- 두 사람의 관점을 균형 있게 다룬다.
- 이 문서는 개인용이므로 진정성과 완전함이 가장 중요하다.
- 제목: "[NSFW] ${charName}(${charGender}) X ${userName}(${userGender})"
`.trim();
	} else {
		// SFW
		return eng
			? `
${coreInstructionEng}

Your story must include:
1. The full progression of their adult romantic relationship, including all key events and conversations suggested by the recaps (in chronological order).
2. Genuine emotions, desires, and intimacy between two adults, inferred from the recaps—be honest, but use tasteful language.
3. Romantic and physical attraction, based on the recaps, shown with restraint and elegance (no explicit details).
4. Both characters' personalities, voices, and how they influence each other, as suggested by the recaps.
5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events indicated in the recaps—describe them clearly.
6. Emotional and psychological intimacy, as well as physical closeness, based on the recaps, but always in a way suitable for ages 15+.

Guidelines:
- Do not hide or disguise their feelings inferred from the recaps, but keep descriptions appropriate for teens.
- Write in third person, with warmth and depth.
- Balance both perspectives.
- This is for sharing: authenticity and beauty matter, but so does restraint.
- Title: "The Love Story of ${userName} (${userGender}) and ${charName} (${charGender}): A Mature Romance"
`.trim()
			: `
${coreInstructionKor}

반드시 포함한다:
1. 요약본에서 암시된 두 성인 사이의 로맨틱 관계의 전체 진행 과정과 모든 주요 사건, 대화 (시간순).
2. 요약본에서 추론한 진실한 감정, 욕망, 친밀감—솔직하게 묘사하되 품위 있게 표현.
3. 요약본을 기반으로 한 로맨틱하고 신체적 끌림은 절제되고 우아하게(노골적 묘사 없이).
4. 요약본에서 암시된 두 사람의 개성과 목소리, 서로에게 미친 영향.
5. 요약본에 나타난 갈등, 화해, 고백, 약속, 여행 등 의미 있는 이벤트를 명확하게 묘사.
6. 요약본을 기반으로 한 감정적·심리적 친밀감과 신체적 가까움도 15세 이상이 읽을 수 있게 표현.

작성 지침:
- 요약본에서 추론한 감정을 숨기거나 위장하지 말고, 묘사는 청소년도 읽을 수 있게 한다.
- 3인칭, 따뜻하고 깊이 있는 문체로 작성한다.
- 두 사람의 관점을 균형 있게 다룬다.
- 이 문서는 공유용이므로 진정성과 아름다움, 그리고 절제가 모두 중요하다.
- 제목: "[SFW] ${charName}(${charGender}) X ${userName}(${userGender})"
`.trim();
	}
};

export const buildHistoryMetadataPrompt = (
	originalTitle: string,
	content: string,
	availableCharacterIds: string[],
	existingHistoryEntries: Array<{
		originalTitle: string;
		historyId: string;
		generatedTitle: string;
	}> = [],
	existingLoreIds: string[] = [],
	eng?: boolean
): string =>
	eng
		? `You are an expert AI assistant who analyzes character backstories to extract structured metadata.

**Original Title:** ${originalTitle}
**Event Content:**
${content}

**Contextual Information:**
- Available Character IDs: ${availableCharacterIds.join(', ')}
- Existing History Entries: ${existingHistoryEntries.map((h) => `- "${h.originalTitle}" (ID: ${h.historyId})`).join('\n') || 'N/A'}
- Existing Lore IDs: ${existingLoreIds.join(', ') || 'N/A'}

Respond with a JSON object with the following structure (all metadata MUST be in English):

{
  "summary": "string (A concise 2-3 sentence summary in English, max 75 words, capturing the core event and its outcome.)",
  "generatedEnglishTitle": "string (A specific, descriptive English title based on the content)",
  "englishId": "string (A 2-3 word kebab-case ID from the English title, e.g., 'childhood-protection-desire')",
  "keywords": ["string (5-10 important English keywords)"],
  "topics": ["string (3-7 main English themes, e.g., 'war', 'betrayal')"],
  "entities": ["string (Format: 'type:name')"],
  "ownerCharacterIds": ["string (IDs of main characters in this event)"],
  "sideCharacterIds": ["string (IDs of side characters)"],
  "period": { "label": "string (e.g., 'Childhood')", "confidence": "number (0.0-1.0)" },
  "eventDate": { "value": "string (e.g., 'Age 8-12')", "type": "string (e.g., 'relative_to_birth')", "confidence": "number (0.0-1.0)" },
  "temporalRelations": [{ "type": "string (e.g., 'PRECEDES')", "relatedEventId": "string (A historyId)", "description": "string" }],
  "category": "string (e.g., 'character_history', 'world_event')"
}

**Instructions:**
- The "summary" is CRITICAL. It must accurately reflect the entire event.
- Base "temporalRelations" on the provided Existing History Entries.
- All metadata fields must be filled.

Provide ONLY the pure JSON object as your output.
`.trim()
		: `
당신은 캐릭터 역사(시간순 사건) 텍스트를 분석하여 메타데이터를 추출하는 전문가다.

원본 제목: ${originalTitle}
사건 내용:
${content}

사용 가능한 캐릭터 ID: ${availableCharacterIds.join(', ')}

기존 역사 사건들:
${existingHistoryEntries.map((h) => `- "${h.originalTitle}" → "${h.generatedTitle}" (ID: ${h.historyId})`).join('\n')}

기존 로어 ID들: ${existingLoreIds.join(', ')}

다음 JSON 형식으로 응답한다 (메타데이터는 영어로만):

{
  "summary": "string (A concise 3-5 sentence summary in English, max 200 words, capturing the core event and its outcome.)",
  "generatedEnglishTitle": "Childhood Protection Desire Inherited from Tarion's Father",
  "englishId": "childhood-protection-desire",
  "keywords": ["childhood", "protection", "trauma"],
  "topics": ["character_development", "emotional_growth"],
  "entities": ["character:Tarion", "location:Village"],
  "ownerCharacterIds": ["tarion_original", "tarion_spinoff"],
  "sideCharacterIds": ["kassar_original"],
  "period": {
    "label": "Childhood",
    "confidence": 0.9
  },
  "eventDate": {
    "value": "Age 8-12",
    "type": "relative_to_birth",
    "confidence": 0.8
  },
  "temporalRelations": [
    {
        "type": "PRECEDES",
        "relatedEventId": "existing_history_id_here",
        "description": "This childhood event shaped later decisions"
    }
  ],
  "category": "character_history"
}

**메타데이터 지침:**
- **generatedEnglishTitle**: 내용을 바탕으로 한 구체적이고 설명적인 영어 제목 생성
- **englishId**: 영어 제목을 기반으로 한 **최대 3단어**의 kebab-case 식별자 (예: "childhood-protection-desire", "sword-betrayal", "final-battle")
- **keywords**: 역사 사건에서 중요한 키워드 5-10개 (영어)
- **topics**: 주요 테마나 주제 3-7개 (예: "war", "betrayal", "coming_of_age")
- **entities**: 언급된 인물, 장소, 아이템 등 (형식: "type:name")
- **ownerCharacterIds**: 이 역사 사건의 주인공 캐릭터 ID들
- **sideCharacterIds**: 이 역사 사건에 등장하는 조연 캐릭터 ID들
- **period**: 사건이 일어난 시기/시대 (라벨과 확신도)
- **eventDate**: 구체적인 날짜나 시점 (값, 타입, 확신도)
- **temporalRelations**: 기존 사건들과의 시간적 관계 (historyId로 참조)
- **category**: 역사 카테고리 (예: "character_history", "world_event", "relationship")

**시간 관계 규칙:**
- relatedEventId는 반드시 기존 역사 사건의 historyId를 사용
- 기존 역사 사건이 없으면 빈 배열 사용
- 로어 참조는 별도 필드에서 처리 (향후 확장 가능)

**englishId 생성 규칙:**
- 최대 3단어로 제한 (예: "childhood-protection-desire", "sword-betrayal")
- kebab-case 형식 사용 (단어 사이에 하이픈)
- 사건의 핵심을 간결하게 표현

**작성 규칙:**
- 요약(summary)은 매우 중요하므로, 발생한 모든 사건을 명확히 반영하고 있어야 함
- 모든 메타데이터는 영어로만 작성
- JSON 형식을 정확히 지켜서 작성
- 마크다운 코드 블록 없이 순수 JSON만 출력

JSON 출력:
`.trim();

export const buildTermTranslationPrompt = (koreanTerm: string): string => {
	return `Translate the following Korean proper noun into its most common English equivalent. Provide only the English translation, with no additional text or punctuation.

Korean Proper Noun: "${koreanTerm}"

English Translation:`;
};

export const buildNerPrompt = (textToAnalyze: string): string => {
	return `Extract all unique proper nouns (names of people, characters, places, organizations, specific items, etc.) from the following Korean text.
Return your response as a JSON array of strings. For example: ["Proper Noun 1", "Another Noun"].
If no proper nouns are found, return an empty array [].

Korean Text:
"""
${textToAnalyze}
"""

JSON Array of Proper Nouns:`;
};

export const buildJsonCorrectionPrompt = (
	failedOutput: string,
	errorMessage: string,
	originalSchemaDescription: string // e.g., '{"response": "string", "emotion": "string"}'
): string =>
	`
The previous attempt to generate a JSON response failed.

**PREVIOUS FAILED OUTPUT:**
\`\`\`
${failedOutput}
\`\`\`

**PARSING ERROR:**
${errorMessage}

Please correct the previous output. You MUST provide the response again, strictly adhering to the requested JSON format and schema. Do not add any commentary or introductory text.

**REQUIRED JSON SCHEMA:**
${originalSchemaDescription}
`.trim();
