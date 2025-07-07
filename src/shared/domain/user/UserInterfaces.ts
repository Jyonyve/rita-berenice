export interface UserMetadata {
	userId: string;
	gender: string;
	title: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	contact: string;
}
export type UserInfo = UserMetadata;

export type UserCdo = Pick<UserInfo, 'userId' | 'showName'>;
