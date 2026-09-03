import { METADATA_TYPES } from '../../config/constants.js';
import { BeingMetadata } from '../character/character.type.js';

export interface ProfileMetadata extends BeingMetadata {
  profileId: string; //${userId}_${sessionId}
  sessionId: string;
  type: typeof METADATA_TYPES.PROFILE;
}

export interface ProfileDocument {
  description: string;
}

export type ProfileInfo = ProfileMetadata & ProfileDocument;

export type ProfileCdo = Pick<
  ProfileInfo,
  'description' | 'gender' | 'name' | 'showName' | 'title' | 'userId' | 'sessionId'
>;
