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
export const buildLlmFactualRecapPrompt = (charName: string, stringifyChatTurns: string): string =>
	`
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
	stringifyChatTurns: string
): string =>
	`
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
