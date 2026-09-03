import { ChatEntry } from '@rita-berenice/shared/domain';
import { parseChatEntries, serializeChatEntries } from '@rita-berenice/shared/util';

export const parseTextToEntries = (text: string): ChatEntry[] => parseChatEntries(text, 'asterisk-actions');

export const parseEntriesToText = (entries: ChatEntry[]): string => serializeChatEntries(entries, 'asterisk-actions');
