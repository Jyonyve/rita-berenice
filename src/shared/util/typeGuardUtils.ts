import { CharacterCdo, CharacterInfo } from '../domain/character/CharacterInterfaces.js';
import { ProfileCdo, ProfileInfo } from '../domain/profile/ProfileInterfaces.js';
import {
	CharacterTermCdo,
	CharacterTermInfo,
	SessionTermCdo,
	SessionTermInfo,
} from '../domain/term/TermInterfaces.js';
import {
	buildCharacterId,
	buildChatTurnId,
	buildHistoryId,
	buildProfileId,
	buildUserShowName,
} from './buildIdUtils.js';
import { ChatTurn, ChatTurnCdo } from '../domain/chat/ChatInterfaces.js';
import { parseSessionId } from './parseUtils.js';
import { HistoryCdo, HistoryInfo, LoreCdo, LoreInfo } from '../domain/lore/LoreInterfaces.js';
import { DEFAULT_USER_AVATAR, NA } from '../config/constants.js';
import { DEFAULT_EMOTION } from '../config/emotionConstants.js';
import { UserCdo, UserInfo } from '../domain/user/UserInterfaces.js';

//type guard
export function isCharacterTermInfo(
	term: CharacterTermCdo | CharacterTermInfo
): term is CharacterTermInfo {
	return (term as CharacterTermInfo).englishTerm !== undefined;
}

export function isSessionTermInfo(term: SessionTermCdo | SessionTermInfo): term is SessionTermInfo {
	return (term as SessionTermInfo).englishTerm !== undefined;
}

export function isCharacterInfo(
	character: CharacterCdo | CharacterInfo
): character is CharacterInfo {
	return (character as CharacterInfo).characterId !== undefined;
}

export function isProfileInfo(profile: ProfileCdo | ProfileInfo): profile is ProfileInfo {
	return (profile as ProfileInfo).profileId !== undefined;
}

export function isUserInfo(user: UserCdo | UserInfo): user is UserInfo {
	return (user as UserInfo).type !== undefined;
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

export const createBasicUserInfo = (cdo: UserCdo): UserInfo => {
	const now = new Date().toISOString();

	return {
		title: '(•‿•)',
		showName: buildUserShowName(),
		email: cdo.email,
		contact: cdo.email,
		createdAt: now,
		updatedAt: now,
		type: 'user',
		userId: cdo.userId,
		gender: 'other',
		avatarUrl: DEFAULT_USER_AVATAR,
	};
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
		category: 'Other',
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
