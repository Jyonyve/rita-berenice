import { ChatEntry } from '../domain/chat/chat.type.js';

export type ChatEntrySyntax = 'asterisk-actions' | 'quoted-dialogue';

const normalizeLineBreaks = (text: string) => text.replace(/\r\n|\r/g, '\n');

const normalizeQuotes = (text: string) =>
  text.replace(/[\u201c\u201d\u201e\u201f]/g, '"').replace(/[\u2018\u2019\u201a\u201b]/g, "'");

const appendEntry = (entries: ChatEntry[], type: ChatEntry['type'], prompt: string) => {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) return;

  const previous = entries.at(-1);
  if (previous?.type === type) {
    previous.prompt += `\n${normalizedPrompt}`;
    return;
  }

  entries.push({ type, prompt: normalizedPrompt });
};

const parseAsteriskActions = (text: string): ChatEntry[] => {
  const entries: ChatEntry[] = [];
  const pattern = /\*([^*]+)\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    appendEntry(entries, 'dialogue', text.slice(cursor, match.index));
    appendEntry(entries, 'action', match[1]);
    cursor = match.index + match[0].length;
  }

  appendEntry(entries, 'dialogue', text.slice(cursor));
  return entries;
};

const parseQuotedDialogue = (text: string): ChatEntry[] => {
  const entries: ChatEntry[] = [];
  const pattern = /"([^"]+)"|([^"]+)/g;

  for (const line of normalizeQuotes(text).split('\n')) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      if (match[1] !== undefined) {
        appendEntry(entries, 'dialogue', match[1]);
      } else if (match[2] !== undefined) {
        appendEntry(entries, 'action', match[2]);
      }
    }
  }

  return entries;
};

export const parseChatEntries = (text: string, syntax: ChatEntrySyntax): ChatEntry[] => {
  const normalizedText = normalizeLineBreaks(text);
  if (!normalizedText.trim()) return [];

  return syntax === 'asterisk-actions' ? parseAsteriskActions(normalizedText) : parseQuotedDialogue(normalizedText);
};

export const serializeChatEntries = (entries: ChatEntry[], syntax: ChatEntrySyntax): string =>
  entries
    .map((entry) => {
      if (syntax === 'asterisk-actions') {
        return entry.type === 'action' ? `*${entry.prompt}*` : entry.prompt;
      }
      return entry.type === 'dialogue' ? `"${entry.prompt}"` : entry.prompt;
    })
    .join('\n');
