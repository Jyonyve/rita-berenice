// src/shared/config/langConstants.ts

export type LangCode = 'kor' | 'eng';
export const DEFAULT_LANG: LangCode = 'kor';
type LanguageMap = Record<LangCode, string>;

// The outer record now uses this dynamic LanguageMap type.

export const LANG_KEYS = {
	STATIC_SESSION_DISABLE: 'STATIC_SESSION_DISABLE',
	STATIC_SENDING_DISABLE: 'STATIC_SENDING_DISABLE',
	SESSIONS_WITH_CHARACTER: 'SESSIONS_WITH_CHARACTER',
	CREATE_NEW_PROFILE: 'CREATE_NEW_PROFILE',
	START_NEW_SESSION: 'START_NEW_SESSION',
	CHOOSE_EXISTING_PROFILE: 'CHOOSE_EXISTING_PROFILE',
	CREATE_PROFILE: 'CREATE_PROFILE',
	GENDER: 'GENDER',
	MALE: 'MALE',
	FEMALE: 'FEMALE',
	OTHER: 'OTHER',
	ERROR: 'ERROR',
	CHARACTERS: 'CHARACTERS',
	LOGOUT: 'LOGOUT',
	LOADING_CHARACTERS: 'LOADING_CHARACTERS',
	LOADING_CHAT: 'LOADING_CHAT',
	LOADING_SESSIONS: 'LOADING_SESSIONS',
	FAILED_LOAD_CHAT: 'FAILED_LOAD_CHAT',
	CREATING_SESSION: 'CREATING_SESSION',
} as const;
export type LangKey = keyof typeof LANG_KEYS;

export type LangRecord = Record<LangKey[number], LanguageMap>;

export const langConstants: LangRecord = {
	SESSIONS_WITH_CHARACTER: { kor: '지난 이야기', eng: 'Sessions with this character' },
	CREATE_NEW_PROFILE: { kor: '새 프로필 만들기', eng: 'Create New Profile' },
	CREATE_PROFILE: { kor: '프로필 생성', eng: 'Create Profile' },
	CHOOSE_EXISTING_PROFILE: { kor: '기존 프로필', eng: 'Choose from Existing Profile' },
	START_NEW_SESSION: { kor: '새로운 대화 시작하기', eng: 'Start New Session' },
	GENDER: { kor: '성별', eng: 'GENDER' },
	MALE: { kor: '남성', eng: 'Male' },
	FEMALE: { kor: '여성', eng: 'Female' },
	OTHER: { kor: '기타', eng: 'Other' },
	ERROR: { kor: '에러', eng: 'Error' },
	CHARACTERS: { kor: '캐릭터', eng: 'Characters' },
	LOGOUT: { kor: '로그아웃', eng: 'Logout' },
	LOADING_CHARACTERS: { kor: '캐릭터를 불러오는 중입니다...', eng: 'Loading characters...' },
	LOADING_SESSIONS: { kor: '지난 이야기를 불러오는 중입니다...', eng: 'Loading sessions...' },
	CREATING_SESSION: { kor: '새 이야기를 시작하는 중입니다...', eng: 'Creating new session...' },
	FAILED_LOAD_CHAT: {
		kor: '채팅을 불러오는 데 실패했습니다. 다시 시도해 주세요.',
		eng: 'Failed to load essential chat data. Please try again.',
	},
	LOADING_CHAT: { kor: '채팅을 불러오는 중입니다...', eng: 'Loading chat...' },
};

export const alertToastConstants: LangRecord = {
	CREATE_NEW_PROFILE: {
		kor: '대화에 참여할 프로필을 생성해 주세요.',
		eng: 'Please create a profile before starting a session.',
	},
	STATIC_SENDING_DISABLE: {
		kor: '샘플 사이트에서는 메시지를 보내실 수 없습니다.',
		eng: 'Sending is disabled in static mode',
	},
	STATIC_SESSION_DISABLE: {
		kor: '샘플 사이트에서는 새 대화를 시작하실 수 없습니다.',
		eng: 'New session is disabled in static mode',
	},
};
