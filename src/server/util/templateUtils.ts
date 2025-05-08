// src/util/templateUtils.ts (or your path)
import { allEmotionKeywordsList } from '#root/src/shared/config/index.ts'; // Assuming this path is correct

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
`.trim(); // Use trim() here for cleaner output

export const buildLlmRecapPrompt = (stringifyChatTurns: string): string =>
	`Create a concise recap of the key points from the following recent chat turns:\n${stringifyChatTurns}`;

/**
 * Builds the prompt for generating a relationship-focused recap.
 * @param userName The name/identifier of the user.
 * @param charName The name of the AI character (e.g., Tarion).
 * @param stringifyChatLogs Stringified chat logs for analysis.
 * @returns The prompt string.
 */
export const buildLlmRelationshipRecapPrompt = (
	userName: string,
	charName: string,
	stringifyChatLogs: string
): string =>
	`
You are an AI assistant specialized in analyzing interpersonal dynamics in conversations.
Analyze the following chat turns between ${userName} (the user) and an AI character named ${charName}.
Your goal is to create a concise summary focusing on the evolution and current state of their relationship.

Consider these aspects:
- Trust: Has it grown, diminished, or been tested? Note specific instances if possible.
- Affection/Attachment: Are there signs of growing fondness, dependency, possessiveness, or changes in how affection is expressed?
- Conflict/Tension: Are there unresolved issues, recent arguments, or lingering resentments? How are conflicts handled?
- Communication Style: How do they speak to each other (e.g., formal, informal, teasing, vulnerable, demanding, caring)? Has this style evolved?
- Key Moments: Identify any pivotal conversations, confessions, shared experiences, or events that significantly impacted the relationship.
- Current Emotional Tone: What is the overarching emotional atmosphere of their recent interactions (e.g., loving, strained, playful, anxious, comforting)?

Chat Logs (ensure these logs clearly distinguish between ${userName}'s and ${charName}'s turns):
${stringifyChatLogs}

Based on this analysis, provide a summary of the relationship's current state and recent evolution.
The summary should help ${charName} understand how he should currently perceive and interact with ${userName} in a way that is consistent with their established dynamic.
Focus on actionable insights for ${charName}'s persona. For example, "${charName} now feels deeply protective of ${userName} after they shared a vulnerable moment (sequence X). He might express this through more caring language or by being more attentive to their needs."
The summary should be a direct statement about the relationship, ready to be used as context for ${charName}.
`.trim();

/**
 * Builds a system prompt string to provide relationship context to the LLM for generating a character response.
 * @param relationshipRecapContent The content of the stored relationship recap.
 * @param userName The actual name or identifier of the user/persona the character is interacting with.
 * @param charName The name of the AI character (e.g., Tarion).
 * @returns A formatted string for the system message, or an empty string if no recap.
 */
export const buildRelationshipContextSystemPrompt = (
	relationshipRecapContent: string,
	userName: string = 'the user', // Default if user name isn't dynamically available
	charName: string
): string => {
	if (!relationshipRecapContent || relationshipRecapContent.trim() === '') {
		return ''; // No recap, no context to add
	}
	return `
[Relationship Context with ${userName}]
The following is an AI-generated summary of your (${charName}'s) current relationship dynamics with ${userName}:
"${relationshipRecapContent}"

Remember this context deeply. It reflects your shared history and emotional bond. Let it guide your feelings, attitude, and behavior towards ${userName} to ensure consistency and emotional continuity in your responses. For example, if the summary indicates growing trust, your responses should reflect that. If it mentions recent conflict, acknowledge that tension appropriately.
`.trim();
};
