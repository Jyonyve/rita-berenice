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
	EDIT: 'EDIT',
	SEND: 'SEND',
	STORY: 'STORY',
	CANCEL: 'CANCEL',
	LOADING_CHARACTERS: 'LOADING_CHARACTERS',
	LOADING_CHAT: 'LOADING_CHAT',
	LOADING_SESSIONS: 'LOADING_SESSIONS',
	LOADING_STORIES: 'LOADING_STORIES',
	LOADING_STORY: 'LOADING_STORY',
	FAILED_LOAD_CHAT: 'FAILED_LOAD_CHAT',
	CREATING_SESSION: 'CREATING_SESSION',
	GEN_RESPONSE: 'GEN_RESPONSE',
	NEW_CHARACTER: 'NEW_CHARACTER',
	CHARACTER_CREATED_SUCCESS: 'CHARACTER_CREATED_SUCCESS',
	NO_IMAGES: 'NO_IMAGES',
	PORTRAIT: 'PORTRAIT',
	EMOTION: 'EMOTION',
	BASIC_INFO: 'BASIC_INFO',
	CREATING: 'CREATING',
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
	EDIT: { kor: '수정', eng: 'Edit' },
	SEND: { kor: '보내기', eng: 'Send' },
	TITLE: { kor: '한줄소개', eng: 'Title' },
	SHOWNAME: { kor: '이름', eng: 'show name*' },
	STORY: { kor: '스토리', eng: 'Story' },
	CANCEL: { kor: '취소', eng: 'Cancel' },
	// CREATING: { kor: '스토리', eng: 'Story' },
	CREATING: { kor: '생성중...', eng: 'Creating...' },
	LOADING_CHARACTERS: { kor: '캐릭터를 불러오는 중입니다...', eng: 'Loading characters...' },
	LOADING_SESSIONS: { kor: '지난 이야기를 불러오는 중입니다...', eng: 'Loading sessions...' },
	LOADING_STORIES: { kor: '캐릭터 스토리를 불러오는 중입니다...', eng: 'Loading stories...' },
	LOADING_STORY: { kor: '스토리를 불러오는 중입니다...', eng: 'Loading story...' },
	CREATING_SESSION: { kor: '새 이야기를 시작하는 중입니다...', eng: 'Creating new session...' },
	FAILED_LOAD_CHAT: {
		kor: '채팅을 불러오는 데 실패했습니다. 다시 시도해 주세요.',
		eng: 'Failed to load essential chat data. Please try again.',
	},
	LOADING_CHAT: { kor: '채팅을 불러오는 중입니다...', eng: 'Loading chat...' },
	GEN_RESPONSE: { kor: '답변을 받아오는 중입니다...', eng: 'Generating response...' },
	NEW_CHARACTER: { kor: '새 캐릭터', eng: 'New Character' },
	NO_IMAGES: { kor: '업로드된 이미지가 없습니다.', eng: 'No Images' },
	PORTRAIT: { kor: '초상화', eng: 'Portrait' },
	EMOTION: { kor: '감정', eng: 'emotion' },
	BASIC_INFO: { kor: '기본 정보', eng: 'Basic Information' },
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
	CHARACTER_CREATED_SUCCESS: {
		kor: '캐릭터를 생성하였습니다.',
		eng: 'Character created successfully!',
	},
};
