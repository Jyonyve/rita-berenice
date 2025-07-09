// src/shared/config/langConstants.ts

export type LangCode = 'kor' | 'eng';
export const DEFAULT_LANG: LangCode = 'kor';
type LanguageMap = Record<LangCode, string>;

// The outer record now uses this dynamic LanguageMap type.

export const LANG_KEYS = {
	SESSIONS_WITH_CHARACTER: 'SESSIONS_WITH_CHARACTER',
	CREATE_NEW_PROFILE: 'CREATE_NEW_PROFILE',
	START_NEW_SESSION: 'START_NEW_SESSION',
} as const;
export type LangKey = keyof typeof LANG_KEYS;

export type LangRecord = Record<LangKey[number], LanguageMap>;

export const langConstants: LangRecord = {
	SESSIONS_WITH_CHARACTER: { kor: '지난 이야기', eng: 'Sessions with this character' },
	CREATE_NEW_PROFILE: { kor: '새 프로필 만들기', eng: 'Create New Profile' },
	START_NEW_SESSION: { kor: '새로운 대화 시작하기', eng: 'Start New Session' },
};

export const alertConstants: LangRecord = {
	CREATE_NEW_PROFILE: {
		kor: '대화에 참여할 프로필을 생성해 주세요.',
		eng: 'Please create a profile before starting a session.',
	},
};
