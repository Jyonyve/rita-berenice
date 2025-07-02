import { METADATA_TYPES } from '../../config/constants.ts';
import { BeingMetadata } from '../character/CharacterInterfaces.ts';

export interface ProfileMetadata extends BeingMetadata {
	profileId: string; //${name}_${sessionId}
	sessionId: string;
	type: typeof METADATA_TYPES.PROFILE;
}
export interface ProfileInfo extends ProfileMetadata {
	description: string;
}

export type ProfileCdo = Pick<
	ProfileInfo,
	'description' | 'gender' | 'name' | 'showName' | 'title' | 'userId'
>;
