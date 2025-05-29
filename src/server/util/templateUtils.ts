// src/util/templateUtils.ts (or your path)
import { allEmotionKeywordsList } from '#root/src/shared/config/index.ts';
import { ChatMessage, convertStringToArray, parseEntriesToText } from '#root/src/shared/index.ts';

const REALATIONSHIP_CHARACTERS_LIMIT: number = 3000 as const;
const FACTUAL_CHARACTERS_LIMIT: number = 1500 as const;

// --- EMOTION TEMPLATE (Unchanged, it's good) ---
export const EMOTION_TEMPLATE = `
You MUST respond in JSON format. The JSON object must contain exactly two keys: "response" and "emotion".
"response": Your textual answer to the user, following the persona instructions below.
"emotion": A single keyword representing the character's dominant emotion in the response. Choose the *closest* match from the following list:
[${convertStringToArray(Array.from(allEmotionKeywordsList))}]

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

export const buildChatTurnMetadataPrompt = (
	userName: string,
	userGender: string, // Assuming you get this from profile
	userRequest: ChatMessage,
	charName: string,
	charGender: string, // Assuming you get this from character definition
	charResponse: ChatMessage,
	existingLoreIds: string[], // Pass available Lore IDs for linking
	existingHistoryIds: string[], // Pass available History IDs for linking
	eng?: boolean
): string => {
	const userRequestContent = parseEntriesToText(userRequest.entries);
	const charResponseContent = parseEntriesToText(charResponse.entries);

	const prompt = eng
		? `
You are an expert AI assistant specializing in analyzing conversational turns to extract rich metadata for a Retrieval Augmented Generation (RAG) system.
Analyze the following single turn of conversation between ${userName} (a ${userGender} user) and ${charName} (a ${charGender} character).

**Conversation Turn:**
*   **Session ID:** ${userRequest.sessionId} (for context, not for output field)
*   **Turn Sequence:** ${userRequest.sequence}
*   **User (${userName}, Initial Emotion: ${userRequest.emotion}):** ${userRequestContent}
*   **Character (${charName}, Initial Emotion: ${charResponse.emotion}, Model: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**Your Task:**
Generate a JSON object conforming to the 'EnrichedChatTurnMetadataOutput' interface.
Provide values for ALL fields. If information is not present or not applicable, use default values as specified (e.g., "N/A" for strings, [] for arrays, neutral emotion objects).

**Output JSON Structure (EnrichedChatTurnMetadataOutput):**
\`\`\`json
{
  "turnSummary": "string (Max 50 words, e.g., 'User asks about Tarion's past, Tarion evades.')",
  "keyEntities": ["string (Format: 'type:name', e.g., 'character:Tarion', 'location:DarkForest', 'item:MagicSword')"],
  "extractedTopics": ["string (Keywords or short phrases representing main topics, e.g., 'betrayal', 'quest_for_artifact')"],
  "userEmotionalTone": { 
    "primary": "string (One of: ${convertStringToArray(Array.from(allEmotionKeywordsList))}, or 'mixed')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (Specific emotion words, e.g., 'frustration', 'curiosity')"] 
  },
  "characterEmotionalTone": { 
    "primary": "string (One of: ${convertStringToArray(Array.from(allEmotionKeywordsList))}, or 'mixed')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (Specific emotion words, e.g., 'defensive', 'sadness')"] 
  },
  "relationshipDynamicsShift": ["string (Format: 'Entity1-Entity2:dynamic_change', e.g., '${charName}-${userName}:trust_increased', '${charName}-OtherChar:conflict_hinted')"],
  "dialogueAct": "string (Classify the primary communicative function of the turn, e.g., 'question', 'answer', 'statement_opinion', 'statement_fact', 'command', 'suggestion', 'apology', 'greeting', 'farewell', 'revelation', 'evasion', 'threat', 'promise', 'flirtation', 'action_narration')",
  "keyActionsDescribed": ["string (Observable actions described in text, e.g., '${charName}_draws_sword', '${userName}_offers_potion', '${charName}_looks_away')"],
  "loreReferences": [{ "loreId": "string (ID from provided list: ${convertStringToArray(existingLoreIds)})", "relevance": "number (0.0 to 1.0)" }],
  "historyReferences": [{ "historyId": "string (ID from provided list: ${convertStringToArray(existingHistoryIds)})", "relevance": "number (0.0 to 1.0)" }],
  "triggerFlags": ["string (Specific flags based on content, e.g., 'new_lore_revealed', 'character_goal_updated', 'major_plot_point', 'user_expressed_strong_emotion', 'character_made_promise', 'new_entity_introduced', 'past_event_mentioned')"],
  "memoryChunk": "string (A concise, self-contained statement (max 100 words) of what was learned or happened in this turn, suitable for direct RAG retrieval. Example: 'In turn ${userRequest.sequence}, ${charName} reluctantly revealed a fragment of their past involvement with the Shadow Syndicate when pressed by ${userName}, expressing fear and regret. This event seems to connect to the 'Syndicate_Lore' entry.')"
}
\`\`\`

**Analysis Guidelines:**
*   **turnSummary:** Overall gist of the turn.
*   **keyEntities:** Identify all proper nouns and significant objects/concepts. Use 'character:[Name]', 'location:[Name]', 'item:[Name]', 'organization:[Name]', 'concept:[Name]'.
*   **extractedTopics:** Broader themes or subjects discussed.
*   **EmotionalTone:** Analyze the text and context. The 'primary' emotion should be a general category. 'nuances' can specify further.
*   **relationshipDynamicsShift:** Focus on changes between characters mentioned or implied in this turn. If no shift, use an empty array.
*   **dialogueAct:** Consider the main purpose of the turn's communication.
*   **keyActionsDescribed:** List actions by prefixing with the actor's name (e.g., "${userName}_smiles").
*   **loreReferences/historyReferences:** If the conversation clearly refers to or elaborates on known lore/history, link to it with a relevance score. Only include if relevance is > 0.5.
*   **triggerFlags:** Identify predefined significant event types.
*   **memoryChunk:** This is CRITICAL. Synthesize the most important takeaway from this turn into a dense, searchable memory. It should encapsulate what happened, who was involved, key information revealed, and potential impact.

Ensure the output is a single, valid JSON object.
Provide values for ALL fields, using defaults (empty arrays [], "N/A" for strings, neutral emotion objects) where appropriate.
Example default for emotional tone: { "primary": "neutral", "intensity": 0.5, "nuances": [] }
Example default for turnSummary: "No specific summary."
Example default for dialogueAct: "N/A"
Example default for memoryChunk: "No specific memory chunk generated for this turn."

JSON Output:
`
		: `
당신은 한국어 대화를 분석하여 RAG 시스템용 구조화된 메타데이터를 추출하는 전문가다.
${userName}(${userGender} 사용자)과 ${charName}(${charGender} 캐릭터) 사이의 다음 대화 턴을 분석한다.

**대화 턴:**
*   **세션 ID:** ${userRequest.sessionId}
*   **턴 순서:** ${userRequest.sequence}
*   **사용자 (${userName}, 초기 감정: ${userRequest.emotion}):** ${userRequestContent}
*   **캐릭터 (${charName}, 초기 감정: ${charResponse.emotion}, 모델: ${charResponse.model || 'N/A'}):** ${charResponseContent}

**출력 JSON 구조 (통합된 메타데이터):**
\`\`\`json
{
  "summary": "string (최대 50단어, 예: 'User asks about Tarion's past, Tarion evades.')",
  "keywords": ["string (일반 검색 키워드, 예: 'conversation', 'past', 'evasion')"],
  "topics": ["string (광범위한 주제, 예: 'character_background', 'mystery', 'trust_issues')"],
  "entities": ["string (형식: 'type:name', 예: 'character:Tarion', 'location:DarkForest', 'item:MagicSword')"],
  "userEmotion": { 
    "primary": "string (다음 중 하나: ${convertStringToArray(Array.from(allEmotionKeywordsList))}, 또는 'neutral', 'mixed')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (구체적 감정 단어, 예: 'frustration', 'curiosity')"] 
  },
  "characterEmotion": { 
    "primary": "string (다음 중 하나: ${convertStringToArray(Array.from(allEmotionKeywordsList))}, 또는 'neutral', 'mixed')", 
    "intensity": "number (0.0 to 1.0)", 
    "nuances": ["string (구체적 감정 단어, 예: 'defensive', 'sadness')"] 
  },
  "relationshipShifts": ["string (형식: 'Entity1-Entity2:dynamic_change', 예: '${charName}-${userName}:trust_increased')"],
  "dialogueAct": "string (예: 'question', 'answer', 'statement_opinion', 'revelation', 'evasion')",
  "actions": ["string (관찰 가능한 행동, 예: '${charName}_draws_sword', '${userName}_offers_potion')"],
  "loreReferences": [{ "id": "string (제공된 목록에서: ${convertStringToArray(existingLoreIds)})", "relevance": "number (0.0 to 1.0)" }],
  "historyReferences": [{ "id": "string (제공된 목록에서: ${convertStringToArray(existingHistoryIds)})", "relevance": "number (0.0 to 1.0)" }],
  "flags": ["string (예: 'new_lore_revealed', 'character_goal_updated', 'major_plot_point')"],
  "memoryChunk": "string (최대 100단어, RAG 검색용 자립적 요약)"
}
\`\`\`

**중요 지침:**
- **모든 메타데이터 필드는 영어로만 작성**
- **memoryChunk는 한국어 대화 내용을 영어로 요약**
- 모든 필드에 값을 제공하되, 정보가 없으면 기본값 사용:
  - 빈 배열 [] (리스트용)
  - "N/A" (문자열용)
  - { "primary": "neutral", "intensity": 0.5, "nuances": [] } (감정용)

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

Available Keywords: ${convertStringToArray(availableKeywords)}
Available Topics: ${convertStringToArray(availableTopics)}
Available Entities: ${convertStringToArray(availableEntities)}

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

사용 가능한 키워드 (영어): ${convertStringToArray(availableKeywords)}
사용 가능한 주제 (영어): ${convertStringToArray(availableTopics)}
사용 가능한 개체 (영어): ${convertStringToArray(availableEntities)}

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

Available Keywords: ${convertStringToArray(availableKeywords)}
Available Topics: ${convertStringToArray(availableTopics)}
Available Entities: ${convertStringToArray(availableEntities)}

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

사용 가능한 키워드 (영어): ${convertStringToArray(availableKeywords)}
사용 가능한 주제 (영어): ${convertStringToArray(availableTopics)}
사용 가능한 개체 (영어): ${convertStringToArray(availableEntities)}

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
