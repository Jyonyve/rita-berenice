import {
	CharacterCdo,
	CharacterInfo,
	ProfileCdo,
	ProfileInfo,
	TermCdo,
	TermInfo,
} from '../domain/index.ts';

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
