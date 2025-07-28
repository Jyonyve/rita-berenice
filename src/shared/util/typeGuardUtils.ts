import { CharacterCdo, CharacterInfo } from '../domain/character/CharacterInterfaces.js';
import { ProfileCdo, ProfileInfo } from '../domain/profile/ProfileInterfaces.js';
import { TermCdo, TermInfo } from '../domain/term/TermInterfaces.js';
import {
	buildCharacterId,
	buildChatTurnId,
	buildHistoryId,
	buildProfileId,
} from './buildIdUtils.js';
import { ChatTurn, ChatTurnCdo } from '../domain/chat/ChatInterfaces.js';
import { parseSessionId } from './chatParseUtils.js';
import { HistoryCdo, HistoryInfo, LoreCdo, LoreInfo } from '../domain/lore/LoreInterfaces.js';
import { NA } from '../config/constants.js';
import { DEFAULT_EMOTION } from '../config/emotionWordsMapper.js';

//type guard
export function isTermInfo(term: TermCdo | TermInfo): term is TermInfo {
	return (term as TermInfo).englishTerm !== undefined;
}

export function isCharacterInfo(
	character: CharacterCdo | CharacterInfo
): character is CharacterInfo {
	return (character as CharacterInfo).characterId !== undefined;
}

export function isProfileInfo(profile: ProfileCdo | ProfileInfo): profile is ProfileInfo {
	return (profile as ProfileInfo).profileId !== undefined;
}

export function isHistoryInfo(history: HistoryCdo | HistoryInfo): history is HistoryInfo {
	return (history as HistoryInfo).historyId !== undefined;
}

export function isLoreInfo(lore: LoreCdo | LoreInfo): lore is LoreInfo {
	return (lore as LoreInfo).loreId !== undefined;
}
// init builder

export const createBasicCharacterInfo = (cdo: CharacterCdo): CharacterInfo => {
	const now = new Date().toISOString();
	const characterId = buildCharacterId(cdo.name);
	const variant = characterId.split('_')[1];
	return { ...cdo, characterId, variant, type: 'character', createdAt: now, updatedAt: now };
};

export const createBasicProfileInfo = (cdo: ProfileCdo): ProfileInfo => {
	const now = new Date().toISOString();
	const profileId = buildProfileId(cdo.sessionId, cdo.userId);
	return { ...cdo, profileId, type: 'profile', createdAt: now, updatedAt: now };
};

export const createBasicChatTurn = (cdo: ChatTurnCdo): ChatTurn => {
	const now = new Date().toISOString();
	const chatTurnId = buildChatTurnId(cdo.sessionId, cdo.sequence);
	const profileId = buildProfileId(cdo.sessionId, cdo.userId);
	const { characterId } = parseSessionId(cdo.sessionId);
	return {
		...cdo,
		createdAt: now,
		updatedAt: now,
		chatTurnId,
		profileId,
		type: 'turn',
		characterId,
		summary: '',
		keywordList: [],
		topicList: [],
		entityList: [],
		userEmotion: { primary: DEFAULT_EMOTION, intensity: 0.5, nuanceList: [] },
		characterEmotion: { primary: DEFAULT_EMOTION, intensity: 0.5, nuanceList: [] },
		dialogueAct: NA,
		actionList: [],
		relationshipShiftList: [],
		flagList: [],
		memoryChunk: '',
		loreReferenceList: [],
		historyReferenceList: [],
	};
};

export const createBasicHistory = (cdo: HistoryCdo): HistoryInfo => {
	const now = new Date().toISOString();
	return {
		content: cdo.content,
		createdAt: now,
		updatedAt: now,
		title: cdo.title,
		userId: cdo.userId,
		historyId: '',
		type: 'history',
		generatedTitle: '',
		englishId: '',
		category: 'character_history',
		summary: '',
		periodLabel: 'Unknown',
		eventDateValue: 'Unknown',
		eventDateType: 'relative_to_event',
		characterId: cdo.characterId,
		sideCharacterIdList: [],
		allAffectedCharacterIdList: [],
		relatedEventList: [],
		keywordList: [],
		profileId: '',
		topicList: [],
		entityList: [],
	};
};
