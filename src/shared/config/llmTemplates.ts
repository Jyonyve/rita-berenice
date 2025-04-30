import { allEmotionKeywords } from './emotionWordsMapper.ts';

export const EMOTION_TEMPLATE = `
You MUST respond in JSON format. The JSON object must contain exactly two keys: "response" and "emotion".
"response": Your textual answer to the user, following the persona instructions below.
"emotion": A single keyword representing the character's dominant emotion in the response. Choose the *closest* match from the following list:
[${allEmotionKeywords.join(', ')}]

Example format:
{
  "response": "Oh, hello there! How can I help you today?",
  "emotion": "happy"
}

Respond ONLY with the JSON object. Do not include any text before or after the JSON structure.
` as const;
