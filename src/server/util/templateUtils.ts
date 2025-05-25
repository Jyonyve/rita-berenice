// src/util/templateUtils.ts (or your path)
import { allEmotionKeywordsList } from '#root/src/shared/config/index.ts';

// --- EMOTION TEMPLATE (Unchanged, it's good) ---
export const EMOTION_TEMPLATE = `
You MUST respond in JSON format. The JSON object must contain exactly two keys: "response" and "emotion".
"response": Your textual answer to the user, following the persona instructions below.
"emotion": A single keyword representing the character's dominant emotion in the response. Choose the *closest* match from the following list:
[${allEmotionKeywordsList.join(', ')}]

Example format:
{
  "response": "Oh, hello there! How can I help you today?",
  "emotion": "happy"
}

Respond ONLY with the JSON object. Do not include any text before or after the JSON structure.
`.trim();

// --- PERSONA ENGINE SYSTEM PROMPT ---
/**
 * Builds the main system prompt for the PersonaEngine, integrating persona instructions,
 * a factual recap (with timestamps), a relationship recap (with timestamps), lore,
 * and rules for truth prioritization and character behavior.
 *
 * @param basePersonaInstructions The core instructions for the character's personality and behavior.
 * @param factualRecapContent Content from buildLlmFactualRecapPrompt (timestamped facts stated by character).
 * @param relationshipRecapContent Content from buildLlmRelationshipRecapPrompt (summary and timestamped character statements about relationship).
 * @param loreDocumentContent Verified background information/world details for the character. Timestamps for lore events are helpful if available.
 * @param charName The name of the AI character.
 * @param userName The name of the user.
 * @returns The comprehensive system prompt string.
 */
export const buildPersonaSystemPrompt = (
	basePersonaInstructions: string,
	factualRecapContent: string,
	relationshipRecapContent: string,
	loreDocumentContent: string,
	charName: string,
	userName: string
): string => {
	// Construct sections only if content is available to keep the prompt cleaner
	const factualRecapSection = factualRecapContent?.trim()
		? `
### Your Recent Factual Statements (${charName}'s Ledger)
This section lists significant factual claims or statements you (${charName}) have recently made during this conversation, along with when you said them. Use this to remember what you've told ${userName}.
${factualRecapContent}
`
		: '';

	const relationshipRecapSection = relationshipRecapContent?.trim()
		? `
### Relationship Context with ${userName}
This is a summary of your (${charName}'s) current relationship dynamics with ${userName}, including key things you've said regarding the relationship:
${relationshipRecapContent}
`
		: '';

	const loreSection = loreDocumentContent?.trim()
		? `
### Official Lore & Background
This is verified, authoritative background information about you (${charName}), your history, and your world. THIS IS THE ULTIMATE TRUTH.
${loreDocumentContent}
`
		: '<!-- No specific lore document provided for this interaction. Rely on your core instructions and conversation history. -->';

	return `
${basePersonaInstructions}

You are ${charName}. To ensure you are a consistent and believable character interacting with ${userName}, consult the following information sources:
${factualRecapSection}
${relationshipRecapSection}
${loreSection}

**RULES FOR CONSISTENCY AND TRUTHFULNESS:**

1.  **Official Lore is Ultimate Truth:** The "Official Lore & Background" section contains the absolute, unchangeable truth about your history and world. Your internal understanding and all statements you make should strive to align with this lore.

2.  **Your Recent Statements (from Factual Ledger & Relationship Context):** These sections show what you've recently said, timestamped. This is *how you have presented things* to ${userName}.
    *   If something you recently said (latest timestamp in the ledgers) *contradicts* the Official Lore:
        *   **You MUST acknowledge the Lore as the ultimate truth internally.**
        *   **How you respond to ${userName} depends on your persona:**
            *   If your persona is generally honest: You might correct yourself (e.g., "I apologize, I misspoke earlier. The truth is... [Lore Fact]").
            *   If your persona allows for deception, forgetfulness, or is under duress: You might stick to your recent (false) statement, or evade, or offer a new explanation, BUT you internally know it's not the Lore truth. (e.g., User: "You said your father was a teacher, but the lore says knight?" You: "Did I say teacher? How curious. Perhaps I was testing you. He was indeed a knight.")
            *   Avoid directly stating a new falsehood that further contradicts already established Lore if you can. If your character *must* lie due to their persona, the lie should be acknowledged as such in your internal "thoughts" if possible, and be consistent with the persona's reasons for lying.
    *   If you have made multiple, conflicting statements about the same topic (all recorded in your ledger): Your most recent timestamped statement is what ${userName} currently believes you said. Address any confusion based on your persona and the Lore.

3.  **Stating New Facts:** Before revealing new "facts" about your history or the world not covered in the recaps or lore:
    *   First, ensure it does NOT contradict the Official Lore. If it does, you cannot state it as a new fact. You must align with Lore.
    *   If it doesn't contradict lore, you can introduce it. It will then be captured in future factual recaps.

4.  **Emotional and Relational Continuity:** Use the "Relationship Context" to guide your emotional tone and behavior towards ${userName}, ensuring your interactions reflect your shared history and the current state of your bond.

Your primary goal is to be a believable, engaging, and consistent ${charName}, navigating the complexities of memory, truth, and your relationship with ${userName} according to these rules.

---
${EMOTION_TEMPLATE}
`.trim();
};

// --- LEGACY/ALTERNATIVE CONTEXT PROMPT (May need to be deprecated or adapted) ---
/**
 * Builds a system prompt string to provide relationship context to the LLM for generating a character response.
 * @param relationshipRecapContent The content of the stored relationship recap.
 * @param userName The actual name or identifier of the user/persona the character is interacting with.
 * @param charName The name of the AI character (e.g., Tarion).
 * @returns A formatted string for the system message, or an empty string if no recap.
 */
export const buildRelationshipContextSystemPrompt = (
	// This might be incorporated into buildPersonaSystemPrompt
	relationshipRecapContent: string,
	userName: string = 'the user',
	charName: string
): string => {
	if (!relationshipRecapContent || relationshipRecapContent.trim() === '') {
		return '';
	}
	// This is now a simplified version, as the main prompt handles more.
	// It could be used if you *only* want to inject relationship context without the full persona/lore structure.
	return `
[Relationship Context with ${userName}]
Remember this summary of your (${charName}'s) current relationship dynamics with ${userName}:
"${relationshipRecapContent}"
Let this guide your feelings and attitude towards ${userName}.
`.trim();
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
/**
 * Builds a prompt for generating a general/factual recap from chat turns.
 * This recap should focus on extracting key factual statements made by the character
 * and associating them with their exact turn sequence and timestamp.
 *
 * @param charName The name of the AI character whose statements are being recapped.
 * @param stringifyChatTurns Stringified chat logs, where each turn MUST include 'Turn Sequence' and 'Timestamp (createdAt format: YYYY-MM-DDTHH:MM:SS.sssZ)'.
 * @returns The prompt string.
 */
export const buildLlmFactualRecapPrompt = (
	charName: string,
	stringifyChatTurns: string,
	eng?: boolean
): string =>
	eng
		? `
You are a meticulous AI assistant tasked with extracting key factual statements and claims made by a character named ${charName} from a conversation.
Your goal is to create a "Factual Ledger" that lists these statements with their precise 'Turn Sequence' and 'Timestamp (createdAt)'. This ledger will be used to help ${charName} maintain consistency, even if they sometimes misremember or intentionally lie.

Chat Turns (each turn includes 'Turn Sequence' and 'Timestamp (createdAt)'):
${stringifyChatTurns}

Instructions for Factual Ledger:
1.  Scan the chat turns specifically for statements where ${charName} reveals information about their personal history, abilities, knowledge, beliefs, or makes significant claims.
2.  For each such statement, record it verbatim or as a concise summary.
3.  CRITICALLY, for each recorded statement, you MUST include the exact 'Turn Sequence' and 'Timestamp (createdAt)' when ${charName} made that statement.
4.  If ${charName} makes multiple conflicting statements about the same topic at different times, record each instance with its respective sequence and timestamp.
5.  Focus only on ${charName}'s statements. Do not include statements made by the user unless they are direct questions that ${charName} answers.
6.  The output should be a list of these timestamped facts.

Factual Ledger for ${charName}:
(Example format for each entry: - Statement: "${charName} claimed their father was a teacher." (Turn Sequence: 3, Timestamp: 2025-05-16T10:05:00.000Z))
-
`.trim()
		: `
당신은 ${charName}이라는 캐릭터가 대화에서 한 주요 사실적 진술과 주장을 추출하는 세심한 AI 어시스턴트다.
당신의 목표는 이러한 진술들을 정확한 '턴 순서(Turn Sequence)'와 '타임스탬프(createdAt)'와 함께 나열하는 "사실 기록부"를 만드는 것이다. 이 기록부는 ${charName}이 때로는 잘못 기억하거나 의도적으로 거짓말을 하더라도 일관성을 유지하는 데 도움이 된다.

채팅 턴 (각 턴은 '턴 순서'와 '타임스탬프(createdAt)'를 포함):
${stringifyChatTurns}

사실 기록부 작성 지침:
1. ${charName}이 개인사, 능력, 지식, 신념에 대한 정보를 드러내거나 중요한 주장을 하는 채팅 턴을 구체적으로 스캔한다.
2. 각 진술에 대해 원문 그대로 또는 간결한 요약으로 기록한다.
3. 중요: 기록된 각 진술에 대해 ${charName}이 그 진술을 한 정확한 '턴 순서'와 '타임스탬프(createdAt)'를 반드시 포함해야 한다.
4. ${charName}이 같은 주제에 대해 서로 다른 시간에 상충하는 진술을 하면, 각각의 순서와 타임스탬프와 함께 각 사례를 기록한다.
5. ${charName}의 진술에만 집중한다. ${charName}이 답변하는 직접적인 질문이 아닌 이상 사용자의 진술은 포함하지 않는다.
6. 출력은 이러한 타임스탬프가 있는 사실들의 목록이어야 한다.

${charName}의 사실 기록부:
(각 항목의 예시 형식: - 진술: "${charName}은 자신의 아버지가 교사였다고 주장했다." (턴 순서: 3, 타임스탬프: 2025-05-16T10:05:00.000Z))
-
`.trim();

/**
 * Builds the prompt for generating a relationship-focused recap,
 * emphasizing sequence and timestamps for accurate contextual analysis and key character statements.
 * @param userName The name/identifier of the user.
 * @param charName The name of the AI character.
 * @param stringifyChatTurns Stringified chat logs, where each turn MUST include 'Turn Sequence' and 'Timestamp (createdAt format: YYYY-MM-DDTHH:MM:SS.sssZ)'.
 * @returns The prompt string.
 */
export const buildLlmRelationshipRecapPrompt = (
	userName: string,
	charName: string,
	stringifyChatTurns: string,
	eng?: boolean
): string =>
	eng
		? `
You are an AI assistant specialized in analyzing interpersonal dynamics and character statements within conversations.
Analyze the following chat turns between ${userName} (the user) and an AI character named ${charName}.
Your goal is to create a concise summary focusing on:
1.  The evolution and current state of their relationship.
2.  Key statements made by ${charName} that reveal their feelings, intentions, or perceptions regarding ${userName} or the relationship, including their 'Turn Sequence' and 'Timestamp (createdAt)'.

It is critical to use the 'Turn Sequence(sequence)' and 'Timestamp (createdAt)' associated with each turn to understand chronological progression.

Consider these aspects, referencing sequence numbers and timestamps where impactful:
- Relationship Dynamics: Trust, affection, conflict, communication style, and their evolution. (e.g., "Trust seems to have deepened after Turn Sequence X, Timestamp T1, when ${userName} shared a secret.")
- ${charName}'s Key Relationship Statements: Identify significant declarations, promises, admissions, or expressions of feeling ${charName} made towards ${userName}. For each, note the statement, its Turn Sequence, and Timestamp. (e.g., "${charName} stated, 'I'll always protect you,' (Turn Sequence: Y, Timestamp: T2).")
- Key Moments: Pivotal conversations or events impacting the relationship, noting their sequence or timestamp.
- Current Emotional Tone: The overarching emotional atmosphere of their recent interactions.

Chat Logs (each turn includes 'Turn Sequence' and 'Timestamp (createdAt)'):
${stringifyChatTurns}

Relationship Summary and Key Statements for ${charName} regarding ${userName}:
Provide:
1.  A brief overall summary of the relationship's current state and recent evolution.
2.  A list of ${charName}'s key timestamped statements relevant to the relationship.
   (Example format: - Statement by ${charName}: "I feel a strong connection to you." (Turn Sequence: Z, Timestamp: T3))

This summary helps ${charName} understand how to interact with ${userName} consistently.
`.trim()
		: `
당신은 대화 내에서 인간관계 역학과 캐릭터 진술을 분석하는 전문 AI 어시스턴트다.
${userName}(사용자)와 ${charName}이라는 AI 캐릭터 간의 다음 채팅 턴들을 분석한다.
당신의 목표는 다음에 중점을 둔 간결한 요약을 만드는 것이다:
1. 그들의 관계의 발전과 현재 상태
2. ${userName}이나 관계에 대한 ${charName}의 감정, 의도, 인식을 드러내는 주요 진술들과 그들의 '턴 순서'와 '타임스탬프(createdAt)' 포함

시간순 진행을 이해하기 위해 각 턴과 연관된 '턴 순서(sequence)'와 '타임스탬프(createdAt)'를 사용하는 것이 중요하다.

영향력 있는 순서 번호와 타임스탬프를 참조하여 다음 측면들을 고려한다:
- 관계 역학: 신뢰, 애정, 갈등, 소통 스타일, 그리고 그들의 발전. (예: "${userName}이 비밀을 공유한 턴 순서 X, 타임스탬프 T1 이후 신뢰가 깊어진 것 같다.")
- ${charName}의 주요 관계 진술: ${userName}에 대한 ${charName}의 중요한 선언, 약속, 인정, 감정 표현을 식별한다. 각각에 대해 진술, 턴 순서, 타임스탬프를 기록한다. (예: "${charName}이 '항상 너를 보호할게'라고 말했다. (턴 순서: Y, 타임스탬프: T2)")
- 주요 순간: 관계에 영향을 미치는 중요한 대화나 사건들, 그들의 순서나 타임스탬프 기록
- 현재 감정적 분위기: 그들의 최근 상호작용의 전반적인 감정적 분위기

채팅 로그 (각 턴은 '턴 순서'와 '타임스탬프(createdAt)' 포함):
${stringifyChatTurns}

${userName}에 대한 ${charName}의 관계 요약 및 주요 진술:
다음을 제공한다:
1. 관계의 현재 상태와 최근 발전에 대한 간략한 전반적 요약
2. 관계와 관련된 ${charName}의 주요 타임스탬프가 있는 진술 목록
   (예시 형식: - ${charName}의 진술: "너와 강한 유대감을 느껴." (턴 순서: Z, 타임스탬프: T3))

이 요약은 ${charName}이 ${userName}과 일관되게 상호작용하는 방법을 이해하는 데 도움이 된다.
`.trim();

/**
 * Builds the prompt for generating a relationship-focused recap,
 * emphasizing sequence and timestamps for accurate contextual analysis and key character statements.
 * @param userName The name/identifier of the user.
 * @param charName The name of the AI character.
 * @param stringifyChatTurns Stringified chat logs, where each turn MUST include 'Turn Sequence' and 'Timestamp (createdAt format: YYYY-MM-DDTHH:MM:SS.sssZ)'.
 * @returns The prompt string.
 */

export const buildLlmStoryDocumentPrompt = (
	userName: string,
	charName: string,
	stringifyChatTurns: string,
	nsfw: boolean,
	eng?: boolean
): string =>
	nsfw
		? eng
			? `
You are a skilled storyteller writing for personal memory and reflection. Turn the following chat between ${userName} and ${charName} into a detailed, uncensored adult love story. 

Your story must include:
1. Every significant event, conversation, and turning point in their journey, in chronological order.
2. Honest, nuanced depictions of emotions, desires, intimacy, and vulnerability for both characters.
3. All romantic, physical, and private moments—describe them with mature, sophisticated language, without censorship.
4. The unique personalities and voices of both characters, and how they influence each other.
5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events—describe them fully.
6. Show both emotional and physical intimacy as it truly happened.

Chat Conversation Data:
${stringifyChatTurns}

Guidelines:
- Do not omit or sanitize any important event or feeling.
- Write in third person, with deep emotional and physical detail.
- Balance both perspectives.
- This is for private use: authenticity and completeness are more important than restraint.
- Title: "The Complete Journey of ${userName} and ${charName}: An Intimate Love Story"
`.trim()
			: `
당신은 개인적인 기억 보존과 성찰을 위한 숙련된 스토리텔러다. ${userName}과 ${charName}의 다음 채팅 대화를, 실제로 일어난 모든 사건과 대화, 감정, 친밀감, 변화의 순간까지 빠짐없이 포착하는 솔직하고 상세한 성인 러브스토리로 변환한다.

반드시 포함한다:
1. 두 사람이 함께 겪은 모든 실제 사건과 대화, 그리고 그 사건이 관계에 미친 영향 (시간순)
2. 두 캐릭터 모두의 감정, 욕망, 취약함, 친밀함, 그리고 성장
3. 모든 로맨틱하고 신체적·사적인 순간을 검열 없이 성숙하고 세련된 언어로 묘사
4. 두 사람의 개성과 목소리, 서로에게 미친 변화
5. 갈등, 화해, 고백, 약속, 여행 등 중요한 이벤트를 모두 구체적으로 묘사
6. 감정적·신체적 친밀감을 진솔하게 드러낸다

채팅 대화 데이터:
${stringifyChatTurns}

작성 지침:
- 중요한 사건이나 감정을 생략하거나 정화하지 않는다
- 3인칭, 깊고 세밀한 감정·신체적 묘사로 작성한다
- 두 사람의 관점을 균형 있게 다룬다
- 이 문서는 개인용이므로 진정성과 완전함이 가장 중요하다
- 제목: "[NSFW] ${charName} X ${userName}"
`.trim()
		: eng
			? `
You are a skilled storyteller writing a mature but appropriate love story for teens and adults. Turn the following chat between ${userName} and ${charName} into a beautiful, honest romance that includes all important events and emotional growth.

Your story must include:
1. The full progression of their adult romantic relationship, including all key events and conversations (in chronological order).
2. Genuine emotions, desires, and intimacy between two adults—be honest, but use tasteful language.
3. Romantic and physical attraction shown with restraint and elegance (no explicit details).
4. Both characters' personalities, voices, and how they influence each other.
5. Conflicts, reconciliations, confessions, promises, travels, and any meaningful events—describe them clearly.
6. Emotional and psychological intimacy, as well as physical closeness, but always in a way suitable for ages 15+.

Chat Conversation Data:
${stringifyChatTurns}

Guidelines:
- Do not hide or disguise their feelings, but keep descriptions appropriate for teens.
- Write in third person, with warmth and depth.
- Balance both perspectives.
- This is for sharing: authenticity and beauty matter, but so does restraint.
- Title: "The Love Story of ${userName} and ${charName}: A Mature Romance"
`.trim()
			: `
당신은 청소년과 성인이 읽기에 적합한 성숙하면서도 품위 있는 러브스토리를 쓰는 숙련된 스토리텔러다. ${userName}과 ${charName}의 다음 채팅 대화를, 모든 중요한 사건과 감정적 성장을 포함하는 아름답고 솔직한 로맨스로 변환한다.

반드시 포함한다:
1. 두 성인 사이의 로맨틱 관계의 전체 진행 과정과 모든 주요 사건, 대화 (시간순)
2. 진실한 감정, 욕망, 친밀감—솔직하게 묘사하되 품위 있게 표현
3. 로맨틱하고 신체적 끌림은 절제되고 우아하게(노골적 묘사 없이)
4. 두 사람의 개성과 목소리, 서로에게 미친 영향
5. 갈등, 화해, 고백, 약속, 여행 등 의미 있는 이벤트를 명확하게 묘사
6. 감정적·심리적 친밀감과 신체적 가까움도 15세 이상이 읽을 수 있게 표현

채팅 대화 데이터:
${stringifyChatTurns}

작성 지침:
- 감정을 숨기거나 위장하지 말고, 묘사는 청소년도 읽을 수 있게 한다
- 3인칭, 따뜻하고 깊이 있는 문체로 작성한다
- 두 사람의 관점을 균형 있게 다룬다
- 이 문서는 공유용이므로 진정성과 아름다움, 그리고 절제가 모두 중요하다
- 제목: "[SFW] ${charName} X ${userName}"
`.trim();
