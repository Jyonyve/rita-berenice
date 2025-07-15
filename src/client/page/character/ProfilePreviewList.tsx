// src/client/components/profile/ProfilePreviewList.tsx

import { FC, Fragment } from 'react';
import {
	ListItem,
	ListItemButton,
	ListItemText,
	Typography,
	CircularProgress,
	Divider,
} from '@mui/material';
import { useProfileApi } from '../../hook/api/index.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { notFoundMessage } from '#shared/util/languageUtils.js';

// The props are updated to handle two separate click events
export const ProfilePreviewList: FC<{
	userId: string;
	selectedProfileId: string; // The ID of the currently highlighted profile
	onClickProfile: (profileId: string) => void; // Handler for single-click (highlighting)
	onDoubleClickProfile: (profileInfo: ProfileInfo) => void; // Handler for double-click (copying)
}> = ({ userId, selectedProfileId, onClickProfile, onDoubleClickProfile }) => {
	const { data: profileRes, isLoading, error } = useProfileApi().getAllProfilesByUserId(userId);

	if (isLoading) {
		return (
			<ListItem>
				<CircularProgress size={24} />
			</ListItem>
		);
	}
	if (error) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="error">
							{error.message}
						</Typography>
					}
				/>
			</ListItem>
		);
	}
	if (!profileRes?.profileInfos?.length) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							{notFoundMessage('profiles')}
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	return (
		<>
			{profileRes.profileInfos.map((profile) => (
				<Fragment key={profile.profileId}>
					<ListItem disablePadding>
						<ListItemButton
							selected={profile.profileId === selectedProfileId}
							onClick={() => onClickProfile(profile.profileId)} // Set highlight on single click
							onDoubleClick={() => onDoubleClickProfile(profile)} // Copy data on double click
						>
							<ListItemText
								primary={
									<Typography variant="subtitle1" fontWeight="bold">
										{profile.showName}
									</Typography>
								}
								secondary={
									<Typography variant="body2" color="text.secondary" noWrap>
										{profile.description}
									</Typography>
								}
							/>
						</ListItemButton>
					</ListItem>
					<Divider component="li" />
				</Fragment>
			))}
		</>
	);
};
