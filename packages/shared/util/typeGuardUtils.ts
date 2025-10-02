import {
	buildCharacterId,
	buildChatTurnId,
	buildHistoryId,
	buildLoreId,
	buildProfileId,
	buildUserShowName,
} from './buildIdUtils.js';
import { parseSessionId } from './parseUtils.js';
import {
	CharacterCdo,
	CharacterInfo,
	CharacterTermCdo,
	CharacterTermInfo,
	ChatTurn,
	ChatTurnCdo,
	HistoryCdo,
	HistoryInfo,
	LoreCdo,
	LoreInfo,
	MiscLoreCdo,
	ProfileCdo,
	ProfileInfo,
	SessionTermCdo,
	SessionTermInfo,
	UserCdo,
	UserInfo,
	WorldLoreCdo,
} from '../domain/index.js';
import { NA } from '../config/constants.js';
import { DEFAULT_EMOTION } from '../config/emotionConstants.js';
import { DEFAULT_USER_AVATAR } from '../config/imageConstants.js';

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

export function isWorldLore(cdo: WorldLoreCdo | MiscLoreCdo): cdo is WorldLoreCdo {
	return (cdo as WorldLoreCdo).category === 'World';
}

// init builder

export const createBasicCharacterInfo = (cdo: CharacterCdo): CharacterInfo => {
	const now = new Date().toISOString();
	const characterId = buildCharacterId(cdo.name);
	const variant = characterId.split('_')[1];
	return {
		...cdo,
		characterId,
		variant,
		type: 'character',
		createdAt: now,
		updatedAt: now,
		firstMessage: '',
	};
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

// in typeGuardUtils.ts (alongside createBasicHistory)
export const createBasicLore = (cdo: LoreCdo): LoreInfo => {
	const now = new Date().toISOString();
	const loreId = buildLoreId(cdo.userId);
	return isWorldLore(cdo)
		? {
				...cdo,
				loreId,
				type: 'world',
				generatedTitle: '',
				summary: '',
				category: 'World',
				createdAt: now,
				updatedAt: now,
				keywordList: [],
				topicList: [],
				entityList: [],
				characterIds: cdo.characterIds ?? [],
			}
		: {
				...cdo,
				loreId,
				type: 'lore',
				generatedTitle: '',
				summary: '',
				category: 'Other',
				createdAt: now,
				updatedAt: now,
				source: '',
				keywordList: [],
				topicList: [],
				entityList: [],
				characterIds: cdo.characterIds ?? [],
			};
};

export const createBasicHistory = (cdo: HistoryCdo): HistoryInfo => {
	const now = new Date().toISOString();
	const historyId = buildHistoryId(cdo.userId);
	return {
		content: cdo.content,
		createdAt: now,
		updatedAt: now,
		title: cdo.title,
		userId: cdo.userId,
		historyId,
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
		topicList: [],
		entityList: [],
	};
};
