// src/client/components/profile/ProfilePreviewList.tsx

import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import {
	CircularProgress,
	Divider,
	ListItem,
	ListItemButton,
	ListItemText,
	Typography,
} from '@mui/material';
import { FC, Fragment } from 'react';
import { useProfileApi } from '../../hook/api/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

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
			<ListItem sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
				<GlassCircularProgress colorVariant="silver" />
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
							{getLangText(LANG_KEYS.NO_PROFILES)}
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
							sx={{ py: 0.5 }}
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
