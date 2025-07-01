import {
	CharacterCdo,
	CharacterInfo,
	ProfileCdo,
	ProfileInfo,
} from '../domain/character/CharacterInterfaces.js';
import { TermCdo, TermInfo } from '../domain/term/TermInterfaces.js';

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
