import { FC, useState, useEffect } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import {
	Avatar,
	Box,
	Button,
	Chip,
	Divider,
	Grid,
	IconButton,
	Stack,
	Tooltip,
	Typography,
	TextField,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	FormHelperText,
} from '@mui/material';
import {
	Edit as EditIcon,
	Email as EmailIcon,
	Badge as BadgeIcon,
	ContactMail as ContactIcon,
	Schedule as ScheduleIcon,
	PhotoCamera as PhotoCameraIcon,
	Save as SaveIcon,
	Cancel as CancelIcon,
	People as PeopleIcon,
	Chat as ChatIcon,
} from '@mui/icons-material';

import { GlassCard, GlassPaper } from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { genderToLangKey, getGenderSelectLabel, getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { UserInfo, UserUdo } from '#shared/domain/user/UserInterfaces.js';
import { GENDER_OPTIONS, GENDER_OPTION } from '#shared/config/constants.js';
import { CharacterInfo } from '#shared/domain/character/index.js';
import { useDateFormatter, useResponsive } from '../../hook/index.js';
import { useUserApi } from '../../hook/api/index.js';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';

// Helper to get gender color
const getGenderColor = (gender: GENDER_OPTION) => {
	switch (gender) {
		case 'male':
			return '#4FC3F7';
		case 'female':
			return '#F48FB1';
		case 'other':
			return '#AB47BC';
		default:
			return '#78909C';
	}
};

const UserPage: FC<{
	userInfo: UserInfo;
	myCharacters: CharacterInfo[];
	mySessions: SessionInfo[];
	isOwnProfile: boolean;
}> = ({ userInfo, myCharacters, mySessions, isOwnProfile }) => {
	const { formatDate, formatRelativeDate } = useDateFormatter();
	const { storeUser } = useUserApi();

	const [isEditing, setIsEditing] = useState(false);
	const [avatarPreview, setAvatarPreview] = useState<string>();
	const [avatarFile, setAvatarFile] = useState<File | null>(null);

	const methods = useForm<UserUdo>({
		defaultValues: {
			showName: userInfo.showName,
			title: userInfo.title,
			contact: userInfo.contact,
			gender: userInfo.gender,
			avatarUrl: userInfo.avatarUrl,
		},
	});

	const {
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = methods;

	// Reset form if userInfo changes from parent
	useEffect(() => {
		reset({
			showName: userInfo.showName,
			title: userInfo.title ?? '',
			contact: userInfo.contact ?? '',
			gender: userInfo.gender,
			avatarUrl: userInfo.avatarUrl,
		});
	}, [userInfo, reset]);

	const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const previewUrl = URL.createObjectURL(file);
			setAvatarPreview(previewUrl);
			setAvatarFile(file); // Store the file object for submission
		}
	};

	const onSubmit = (userUdo: UserUdo) => {
		storeUser({ ...userInfo, ...userUdo });
	};

	const handleCancelEdit = () => {
		reset(); // Revert changes to original values
		setAvatarPreview(undefined);
		setIsEditing(false);
	};

	return (
		<GlassPaper key="user-page" className="paper">
			<FormProvider {...methods}>
				<form onSubmit={handleSubmit(onSubmit)}>
					<Grid container spacing={containerSpacing}>
						{/* Main Profile Section */}
						<Grid size={{ xs: 12, md: 8 }}>
							<GlassCard variant="outlined" sx={{ mb: 2, position: 'relative' }}>
								{/* Edit/Save/Cancel Buttons */}
								{isOwnProfile && (
									<Box sx={{ position: 'absolute', top: 16, right: 16 }}>
										{isEditing ? (
											<Stack direction="row" spacing={1}>
												<Tooltip title={getLangText(LANG_KEYS.SAVE)}>
													<IconButton type="submit" color="primary" disabled={isSubmitting}>
														<SaveIcon />
													</IconButton>
												</Tooltip>
												<Tooltip title={getLangText(LANG_KEYS.CANCEL)}>
													<IconButton onClick={handleCancelEdit} color="secondary">
														<CancelIcon />
													</IconButton>
												</Tooltip>
											</Stack>
										) : (
											<Tooltip title={getLangText(LANG_KEYS.EDIT_USER_INFO)}>
												<IconButton onClick={() => setIsEditing(true)}>
													<EditIcon />
												</IconButton>
											</Tooltip>
										)}
									</Box>
								)}

								{/* Header with Avatar and Basic Info */}
								<Box display="flex" alignItems="center" gap={3} my={3}>
									<Box position="relative">
										<Avatar
											src={avatarPreview || userInfo.avatarUrl}
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
										{isEditing && (
											<IconButton
												component="label"
												sx={{
													position: 'absolute',
													bottom: 0,
													right: 0,
													bgcolor: 'rgba(0,0,0,0.6)',
													'&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
												}}
											>
												<PhotoCameraIcon sx={{ fontSize: '1.2rem', color: 'white' }} />
												<input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
											</IconButton>
										)}
									</Box>

									<Box flex={1}>
										{isEditing ? (
											<Stack spacing={2}>
												<Controller
													name="showName"
													control={control}
													rules={{ required: 'Display name is required' }}
													render={({ field }) => (
														<TextField
															{...field}
															label={getLangText(LANG_KEYS.SHOWNAME)}
															variant="standard"
															error={!!errors.showName}
															helperText={errors.showName?.message}
															fullWidth
														/>
													)}
												/>
												<Controller
													name="gender"
													control={control}
													render={({ field }) => (
														<FormControl fullWidth variant="standard">
															<InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel>
															<Select {...field} label={getLangText(LANG_KEYS.GENDER)}>
																{getGenderSelectLabel().map(({ key, label }) => (
																	<MenuItem key={key} value={key}>
																		{label}
																	</MenuItem>
																))}
															</Select>
														</FormControl>
													)}
												/>
											</Stack>
										) : (
											<>
												<Box display="flex" alignItems="center" gap={2} mb={1}>
													<Typography variant="h4" component="h1" fontWeight="bold">
														{userInfo.showName}
													</Typography>
													<Chip
														label={getLangText(genderToLangKey(userInfo.gender))}
														size="medium"
														sx={{ bgcolor: getGenderColor(userInfo.gender), color: 'white', fontWeight: 'bold' }}
													/>
												</Box>
												<Typography variant="body2" color="text.secondary">
													{`${getLangText(LANG_KEYS.ENTER_DATE)} : ${formatDate(userInfo.createdAt)}`}
												</Typography>
											</>
										)}
									</Box>
								</Box>

								<Divider sx={{ my: 6 }} />

								{/* Details Section */}
								<Stack spacing={3}>
									{/* Title */}
									<Box display="flex" alignItems="center" gap={2}>
										<BadgeIcon sx={{ color: 'text.secondary' }} />
										<Box flex={1}>
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.TITLE)}
											</Typography>
											{isEditing ? (
												<Controller
													name="title"
													control={control}
													render={({ field }) => <TextField {...field} variant="standard" fullWidth />}
												/>
											) : (
												<Typography variant="body1">{userInfo.title || 'N/A'}</Typography>
											)}
										</Box>
									</Box>
									{/* Email (Readonly) */}
									<Box display="flex" alignItems="center" gap={2}>
										<EmailIcon sx={{ color: 'text.secondary' }} />
										<Box>
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.EMAIL)}
											</Typography>
											<Typography variant="body1">{userInfo.email}</Typography>
										</Box>
									</Box>

									{/* Contact */}
									<Box display="flex" alignItems="center" gap={2}>
										<ContactIcon sx={{ color: 'text.secondary' }} />
										<Box flex={1}>
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.CONTACT)}
											</Typography>
											{isEditing ? (
												<Controller
													name="contact"
													control={control}
													render={({ field }) => <TextField {...field} variant="standard" fullWidth />}
												/>
											) : (
												<Typography variant="body1">{userInfo.contact || 'N/A'}</Typography>
											)}
										</Box>
									</Box>
								</Stack>
							</GlassCard>
						</Grid>

						{/* Sidebar */}
						<Grid size={{ xs: 12, md: 4 }}>
							<GlassCard variant="outlined">
								<Typography variant="h6" fontWeight="bold" my={2}>
									{getLangText(LANG_KEYS.STATISTICS)}
								</Typography>
								<Stack spacing={2}>
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<PeopleIcon fontSize="small" color="secondary" />
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.MY_CHARACTERS)}
											</Typography>
										</Stack>
										<Typography variant="h6" fontWeight="bold" color="primary">
											{myCharacters.length}
										</Typography>
									</Box>
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<ChatIcon fontSize="small" color="secondary" />
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.MY_SESSIONS)}
											</Typography>
										</Stack>
										<Typography variant="h6" fontWeight="bold" color="primary">
											{mySessions.length}
										</Typography>
									</Box>
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<ScheduleIcon fontSize="small" color="secondary" />
											<Typography variant="body2" color="text.secondary">
												{`${getLangText(LANG_KEYS.LAST)} ${getLangText(LANG_KEYS.UPDATE_DATE)}`}
											</Typography>
										</Stack>
										<Typography variant="body2">{formatRelativeDate(userInfo.updatedAt)}</Typography>
									</Box>
								</Stack>
							</GlassCard>
						</Grid>
					</Grid>
				</form>
			</FormProvider>
		</GlassPaper>
	);
};

export default UserPage;
