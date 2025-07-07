import { METADATA_TYPES } from '../../config/constants.js';
import { BeingMetadata } from '../character/CharacterInterfaces.js';

export interface ProfileMetadata extends BeingMetadata {
	profileId: string; //${userId}_${sessionId}
	sessionId: string;
	type: typeof METADATA_TYPES.PROFILE;
}
export interface ProfileInfo extends ProfileMetadata {
	description: string;
}

export type ProfileCdo = Pick<
	ProfileInfo,
	'description' | 'gender' | 'name' | 'showName' | 'title' | 'userId' | 'sessionId'
>;
