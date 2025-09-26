// Add this to shared/domain/session/sessionInterfaces.ts

import { METADATA_TYPES } from '../../config/constants.js';

export interface SessionMetadata {
	sessionId: string; // Unique ID for the session (e.g., a UUID)
	userId: string; // Foreign key to the User who owns this session
	profileId: string;
	characterId: string; // Foreign key to the Character in this session
	title: string; // User-editable or auto-generated title
	createdAt: string; // ISO 8601 timestamp
	updatedAt: string; // ISO 8601 timestamp of the last message
	messageCount: number; // Total number of turns/messages
	status: 'active' | 'archived'; // Lifecycle status
	type: typeof METADATA_TYPES.SESSION;
}

export interface SessionDocument {
	lastCharMessage: string;
}
export type SessionInfo = SessionMetadata & SessionDocument;

// This type defines the data needed to create a new session.
export type SessionCdo = Pick<SessionInfo, 'userId' | 'characterId' | 'lastCharMessage'>;
