// src/client/page/UserPage.tsx
import { FC, useMemo } from 'react';
import {
	Avatar,
	Box,
	Button,
	Chip,
	Divider,
	Grid,
	IconButton,
	List,
	Stack,
	Tooltip,
	Typography,
} from '@mui/material';

import { GlassCard, GlassPaper } from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import {
	Edit as EditIcon,
	Email as EmailIcon,
	Person as PersonIcon,
	Badge as BadgeIcon,
	ContactMail as ContactIcon,
	Schedule as ScheduleIcon,
	PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { GENDER_OPTION } from '#shared/config/constants.js';
import { CharacterInfo } from '#shared/domain/character/index.js';
import { useDateFormatter } from '../../hook/useDateFormatter.js';

const getGenderColor = (gender: GENDER_OPTION) => {
	switch (gender) {
		case 'male':
			return '#4FC3F7';
		case 'female':
			return '#F48FB1';
		case 'other':
			return '#AB47BC';
		case 'no_comment':
			return '#78909C';
		default:
			return '#78909C';
	}
};

const UserPage: FC<{
	userInfo: UserInfo;
	myCharacters: CharacterInfo[];
	isOwnProfile: boolean;
}> = ({ userInfo, myCharacters, isOwnProfile }) => {
	const { formatDate, formatRelativeDate } = useDateFormatter();

	// const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
	// 	const file = event.target.files?.[0];
	// 	if (file && onAvatarChange) {
	// 		onAvatarChange(file);
	// 	}
	// };

	return (
		<GlassPaper key="user-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Main Profile Section */}
				<Grid size={{ xs: 12, md: 8 }}>
					<GlassCard variant="outlined" sx={{ mb: 2 }}>
						{/* Header with Avatar and Basic Info */}
						<Box display="flex" alignItems="center" gap={3} mb={3}>
							<Box
								position="relative"
								// onMouseEnter={() => setAvatarHover(true)}
								// onMouseLeave={() => setAvatarHover(false)}
							>
								<Avatar
									src={userInfo.avatarUrl}
									alt={userInfo.showName}
									sx={{
										width: 100,
										height: 100,
										fontSize: '2rem',
										bgcolor: getGenderColor(userInfo.gender),
									}}
								>
									{userInfo.showName.charAt(0).toUpperCase()}
								</Avatar>
							</Box>

							<Box flex={1}>
								<Box display="flex" alignItems="center" gap={2} mb={1}>
									<Typography variant="h4" component="h1" fontWeight="bold">
										{userInfo.showName}
									</Typography>
									<Chip
										label={userInfo.gender}
										size="small"
										sx={{ bgcolor: getGenderColor(userInfo.gender), color: 'white', fontWeight: 'bold' }}
									/>
								</Box>

								{userInfo.title && (
									<Typography variant="h6" color="text.secondary" mb={1}>
										{userInfo.title}
									</Typography>
								)}

								<Typography variant="body2" color="text.secondary">
									{`${getLangText(LANG_KEYS.ENTER_DATE)} : ${formatDate(userInfo.createdAt)}`}
								</Typography>
							</Box>

							{isOwnProfile && (
								<Tooltip title={getLangText(LANG_KEYS.EDIT_USER_INFO)}>
									<IconButton
										// onClick={onEditProfile}
										sx={{ bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
									>
										<EditIcon />
									</IconButton>
								</Tooltip>
							)}
						</Box>

						<Divider sx={{ my: 2 }} />

						{/* Contact Information */}
						<Stack spacing={2}>
							<Box display="flex" alignItems="center" gap={2}>
								<EmailIcon sx={{ color: 'text.secondary' }} />
								<Box>
									<Typography variant="body2" color="text.secondary">
										{getLangText(LANG_KEYS.EMAIL)}
									</Typography>
									<Typography variant="body1">{userInfo.email}</Typography>
								</Box>
							</Box>

							{userInfo.contact && (
								<Box display="flex" alignItems="center" gap={2}>
									<ContactIcon sx={{ color: 'text.secondary' }} />
									<Box>
										<Typography variant="body2" color="text.secondary">
											{getLangText(LANG_KEYS.CONTACT)}
										</Typography>
										<Typography variant="body1">{userInfo.contact}</Typography>
									</Box>
								</Box>
							)}

							<Box display="flex" alignItems="center" gap={2}>
								<BadgeIcon sx={{ color: 'text.secondary' }} />
								<Box>
									<Typography variant="body2" color="text.secondary">
										사용자 ID
									</Typography>
									{/* <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
										{userInfo.userId}
									</Typography> */}
								</Box>
							</Box>

							<Box display="flex" alignItems="center" gap={2}>
								<ScheduleIcon sx={{ color: 'text.secondary' }} />
								<Box>
									<Typography variant="body2" color="text.secondary">
										{getLangText(LANG_KEYS.UPDATE_DATE)}
									</Typography>
									<Typography variant="body1">{formatDate(userInfo.updatedAt)}</Typography>
								</Box>
							</Box>
						</Stack>
					</GlassCard>
				</Grid>

				{/* Sidebar */}
				<Grid size={{ xs: 12, md: 4 }}>
					{/* My Characters Section */}
					<GlassCard variant="outlined" sx={{ mb: 2 }}>
						<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
							<Typography variant="h6" fontWeight="bold">
								{getLangText(LANG_KEYS.MY_CHARACTERS)}
							</Typography>
							<Chip label={myCharacters.length} size="small" color="primary" />
						</Box>

						{myCharacters.length === 0 ? (
							<Box textAlign="center" py={3}>
								<PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
								<Typography variant="body2" color="text.secondary">
									{getLangText(LANG_KEYS.NEW_CHARACTER_TITLE)}
								</Typography>
							</Box>
						) : (
							<Stack spacing={1.5}>
								{myCharacters.slice(0, 5).map((character) => (
									<GlassCard
										key={character.characterId}
										variant="outlined"
										sx={{
											cursor: 'pointer',
											transition: 'all 0.2s',
											'&:hover': { bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateY(-1px)' },
											py: 1.5,
											px: 2,
											'&:last-child': { pb: 1.5 },
										}}
									>
										<Typography variant="subtitle2" fontWeight="bold">
											{character.showName}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{`${getLangText(LANG_KEYS.CREATE_DATE)} : ${formatDate(character.createdAt)}`}
										</Typography>
									</GlassCard>
								))}

								{myCharacters.length > 5 && (
									<Button variant="text" size="small">
										+{myCharacters.length - 5}개 더 보기
									</Button>
								)}
							</Stack>
						)}
					</GlassCard>

					{/* Statistics Card */}
					<GlassCard variant="outlined">
						<Typography variant="h6" fontWeight="bold" mb={2}>
							{getLangText(LANG_KEYS.STATISTICS)}
						</Typography>

						<Stack spacing={2}>
							<Box display="flex" justifyContent="space-between" alignItems="center">
								<Typography variant="body2" color="text.secondary">
									{getLangText(LANG_KEYS.MY_CHARACTERS)}
								</Typography>
								<Typography variant="h6" fontWeight="bold" color="primary">
									{myCharacters.length}개
								</Typography>
							</Box>

							<Box display="flex" justifyContent="space-between" alignItems="center">
								<Typography variant="body2" color="text.secondary">
									{getLangText(LANG_KEYS.ENTER_DATE)}
								</Typography>
								<Typography variant="body2">
									{formatRelativeDate(userInfo.updatedAt)}
									일째
								</Typography>
							</Box>
						</Stack>
					</GlassCard>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default UserPage;
