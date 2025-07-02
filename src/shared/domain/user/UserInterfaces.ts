export interface UserMetadata {
	userId: string;
	gender: string;
	title: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	contact: string;
}
export interface UserInfo extends UserMetadata {
	sessionIds: string[];
}

export type UserCdo = Pick<UserInfo, 'userId' | 'showName'>;
