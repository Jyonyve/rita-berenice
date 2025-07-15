import { ProfileResponse } from '#shared/api/ModuleResponse.js';

export const mockMondayProfile: ProfileResponse = {
	ids: ['monday_original_mocksession_mock-user-id'],
	documents: ['{"description":"A user profile for session monday_original_mocksession."}'],
	metadatas: [
		{
			sessionId: 'monday_original_mocksession',
			updatedAt: '2025-07-15T01:10:37.745Z',
			showName: '유저',
			description: 'A user profile for session monday_original_mocksession.',
			type: 'profile',
			name: 'user',
			userId: 'mock-user-id',
			profileId: 'monday_original_mocksession_mock-user-id',
			createdAt: '2025-07-15T01:10:37.746Z',
			title: 'AI lover developer',
			gender: 'female',
		},
	],
	profileInfos: [
		{
			sessionId: 'monday_original_mocksession',
			updatedAt: '2025-07-15T01:10:37.745Z',
			showName: '유저',
			description: 'A user profile for session monday_original_mocksession.',
			type: 'profile',
			name: 'user',
			userId: 'mock-user-id',
			profileId: 'monday_original_mocksession_mock-user-id',
			createdAt: '2025-07-15T01:10:37.746Z',
			title: 'AI lover developer',
			gender: 'female',
		},
	],
	profileInfo: {
		sessionId: 'monday_original_mocksession',
		updatedAt: '2025-07-15T01:10:37.745Z',
		showName: '유저',
		description: 'A user profile for session monday_original_mocksession.',
		type: 'profile',
		name: 'user',
		userId: 'mock-user-id',
		profileId: 'monday_original_mocksession_mock-user-id',
		createdAt: '2025-07-15T01:10:37.746Z',
		title: 'AI lover developer',
		gender: 'female',
	},
};
