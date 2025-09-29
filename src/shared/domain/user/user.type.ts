import { GENDER_OPTION, METADATA_TYPES } from '../../config/constants.js';

/**
 * Metadata for a user document stored in ChromaDB.
 * Uses userId from Supertokens as the primary key.
 */
export interface UserMetadata {
	/** The unique identifier from Supertokens (UUID). Primary key. */
	userId: string;
	/** User's gender information */
	gender: GENDER_OPTION;
	/** User's title or formal designation */
	title: string;
	/** Display name shown in the application */
	showName: string;
	/** User's primary email from Supertokens (authoritative) */
	email: string;
	/** User's preferred contact method (email, SNS, etc.) */
	contact: string;
	/** Creation timestamp in ISO format */
	createdAt: string;
	/** Last update timestamp in ISO format */
	updatedAt: string;
	/** Document type identifier for ChromaDB */
	type: typeof METADATA_TYPES.USER;
	/** Optional URL to user's avatar image in public folder */
	avatarUrl: string;
}

export interface UserDocument {
	email: string;
	userId: string;
}
export type UserInfo = UserMetadata;

export type UserCdo = Pick<UserInfo, 'userId' | 'email'>;
export type UserUdo = Pick<UserInfo, 'gender' | 'title' | 'showName' | 'contact' | 'avatarUrl'>;
