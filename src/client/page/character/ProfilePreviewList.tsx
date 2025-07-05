import { FC } from 'react';
import {
	ListItem,
	ListItemButton,
	ListItemText,
	Typography,
	CircularProgress,
	Divider,
} from '@mui/material';
import { useProfileApi } from '../../hook/api/useProfileApi.js'; // Adjust import as needed

export const ProfilePreviewList: FC<{
	userId: string;
	profileId: string;
	handleClickProfile: (profileId: string) => void;
}> = ({ userId, handleClickProfile, profileId }) => {
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
							Error: {error.message}
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
							No profiles found.
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	return (
		<>
			{profileRes.profileInfos.map((profile) => (
				<div key={profile.profileId}>
					<ListItem disablePadding>
						<ListItemButton
							selected={profile.profileId === profileId}
							onClick={() => handleClickProfile(profile.profileId)}
						>
							<ListItemText
								primary={
									<Typography variant="subtitle1" fontWeight="bold">
										{profile.name}
									</Typography>
								}
								secondary={
									<Typography variant="body2" color="text.secondary" mb={1}>
										{profile.description}
									</Typography>
								}
							/>
						</ListItemButton>
					</ListItem>
					<Divider component="li" />
				</div>
			))}
		</>
	);
};
