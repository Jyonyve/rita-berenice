import React from 'react';
import {
	Box,
	Typography,
	Button,
	Card,
	CardContent,
	Avatar,
	List,
	ListItem,
	ListItemText,
	CircularProgress,
} from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';

// Props: characterId (string), onStartSession (function), onLoadProfile (function)
interface CharacterIntroPageProps {
	characterInfo: CharacterInfo;
	userInfo: UserInfo;
}

const CharacterIntroPage: React.FC<CharacterIntroPageProps> = ({ characterInfo, userInfo }) => {
	const characterId = characterInfo.characterId;
	// Character state: portraits, loading, error
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(characterId);
	const sessionIds = userInfo.sessionIds;
	// Handlers
	// const handleStartSession = () => onStartSession(characterId);
	// const handleLoadProfile = () => profile && onLoadProfile(profile.profileId);

	// Portrait: pick default or first available
	const portraitUrl =
		!isLoadingPortraits && portraitMap && Object.values(portraitMap)[0]
			? Object.values(portraitMap)[0]
			: '';

	return (
		<Box display="flex" flexDirection="row" width="100%" minHeight="80vh" p={4} gap={4}>
			{/* Left: Portrait */}
			<Box flex="0 0 240px" display="flex" alignItems="flex-start" justifyContent="center">
				{isLoadingPortraits ? (
					<CircularProgress />
				) : portraitUrl ? (
					<Avatar
						src={portraitUrl}
						alt={characterInfo?.name ?? 'Character'}
						sx={{ width: 200, height: 200, borderRadius: 3, boxShadow: 3 }}
						variant="rounded"
					/>
				) : (
					<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
				)}
			</Box>

			{/* Right: Info and actions */}
			<Box flex="1 1 0" display="flex" flexDirection="column" gap={3}>
				{/* Title and Description */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="subtitle1" color="text.secondary" mt={1}>
							{characterInfo.showName}
						</Typography>
						<Typography variant="body1" mt={2}>
							{characterInfo.description}
						</Typography>
					</CardContent>
				</Card>

				{/* Session List */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="h6" mb={1}>
							Sessions with this character
						</Typography>

						<List dense>
							{sessionIds && sessionIds.length > 0 ? (
								sessionIds.map((sessionId) => (
									<ListItem key={sessionId} button>
										<ListItemText
											primary={session.title || `Session ${session.sessionId.slice(-6)}`}
											secondary={session.updatedAt ? new Date(session.updatedAt).toLocaleString() : ''}
										/>
									</ListItem>
								))
							) : (
								<Typography variant="body2" color="text.secondary">
									No sessions found.
								</Typography>
							)}
						</List>
					</CardContent>
				</Card>

				{/* User Character Info */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="h6" mb={1}>
							Your Character Profile
						</Typography>
						{isProfileLoading ? (
							<CircularProgress size={24} />
						) : profile ? (
							<>
								<Typography variant="subtitle1" fontWeight="bold">
									{profile.name}
								</Typography>
								<Typography variant="body2" color="text.secondary" mb={1}>
									{profile.description}
								</Typography>
								<Button variant="outlined" size="small" onClick={handleLoadProfile}>
									Load this profile
								</Button>
							</>
						) : (
							<Typography variant="body2" color="text.secondary">
								No profile loaded.
							</Typography>
						)}
					</CardContent>
				</Card>

				{/* Start New Session */}
				<Box display="flex" justifyContent="flex-end" mt={2}>
					<Button
						variant="contained"
						color="primary"
						size="large"
						onClick={handleStartSession}
						disabled={isCharLoading || isPortraitLoading}
					>
						Start New Session
					</Button>
				</Box>
			</Box>
		</Box>
	);
};

export default CharacterIntroPage;
