import { FC, useState, useEffect, useRef, ChangeEvent } from 'react';
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
	Collapse,
	List,
	ListItem,
	ListItemText,
	ListItemButton,
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
	Key as KeyIcon,
	ExpandLess,
	ExpandMore,
} from '@mui/icons-material';

import {
	GlassButton,
	GlassCard,
	GlassCircularProgress,
	GlassPaper,
} from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import {
	genderToLangKey,
	getGenderSelectLabel,
	getLangAlertText,
	getLangText,
} from '../../util/translateUtils.js';
import { LANG_KEYS } from '@rita-berenice/shared/config/langConstants.js';
import { UserInfo, UserUdo } from '@rita-berenice/shared/domain/user/user.type.js';
import { ASPECT_RATIOS, GENDER_OPTION, LIMIT_5MB } from '@rita-berenice/shared/config/constants.js';
import { CharacterInfo } from '@rita-berenice/shared/domain/character/index.js';
import { useDateFormatter, useResponsive } from '../../hook/index.js';
import { useCredentialApi, useUserApi } from '../../hook/api/index.js';
import { SessionInfo } from '@rita-berenice/shared/domain/session/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { UploadedImage } from '@rita-berenice/shared/domain/image/index.js';
import { ImageCropModal, RomanticTitle } from '../../layout/index.js';
import { useNavigate } from 'react-router';
import { routeConstants } from '#client/routeConstants.js';
import { CredentialSection } from './CredentialSection.tsx';
import { UserApiKeys, ValidationResult } from '@rita-berenice/shared/domain/credential/index.js';

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

export const UserPage: FC<{
	userInfo: UserInfo;
	myCharacters: CharacterInfo[];
	mySessions: SessionInfo[];
	userApiKeys: UserApiKeys;
	isMine: boolean;
}> = ({ userInfo, myCharacters, mySessions, userApiKeys, isMine }) => {
	const navigate = useNavigate();
	const { formatDate, formatRelativeDate } = useDateFormatter();
	const {
		shouldUseMobileLayout,
		isSmallScreen,
		isTabletPortrait,
		hasEnoughSpaceForDesktop,
		isWideTablet,
	} = useResponsive();
	const { addToast } = useToast();
	const { storeUser, uploadUserAvatar, createUserFolder } = useUserApi();
	const { validateUserApiKeys } = useCredentialApi();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [isEditing, setIsEditing] = useState(false);
	const [isUploading, setIsUploading] = useState(false);

	// Avatar states similar to CharacterForm's image states
	const [uploadedAvatar, setUploadedAvatar] = useState<UploadedImage | null>(null);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
	const [modalImageUrl, setModalImageUrl] = useState<string>('');

	// Detail section
	const [sessionsExpanded, setSessionsExpanded] = useState(false);

	const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
	const [isValidatingApiKeys, setIsValidatingApiKeys] = useState(false);
	const [apiKeysExpanded, setApiKeysExpanded] = useState(false);

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
		setValue,
		formState: { errors, isSubmitting },
	} = methods;

	// Reset form if userInfo changes from parent
	useEffect(() => {
		if (!isEditing) {
			reset({
				showName: userInfo.showName,
				title: userInfo.title ?? '',
				contact: userInfo.contact ?? '',
				gender: userInfo.gender,
				avatarUrl: userInfo.avatarUrl,
			});
		}
	}, [userInfo, isEditing, reset]);

	// Cleanup effect (similar to CharacterForm)
	useEffect(() => {
		return () => {
			// Clean up any pending object URLs when component unmounts
			if (uploadedAvatar?.preview.startsWith('blob:')) {
				URL.revokeObjectURL(uploadedAvatar.preview);
			}

			if (pendingAvatarFile) {
				const pendingUrl = URL.createObjectURL(pendingAvatarFile);
				URL.revokeObjectURL(pendingUrl);
			}
		};
	}, []);

	// Credential
	// ✅ Validate API keys when data loads
	const validateApiKeys = async (keysToValidate: UserApiKeys) => {
		const keysWithValues = Object.fromEntries(
			Object.entries(keysToValidate).filter(([, value]) => value && value.trim() !== '')
		) as UserApiKeys;

		if (Object.keys(keysWithValues).length === 0) {
			setValidationResults({});
			return;
		}

		setIsValidatingApiKeys(true);
		try {
			const results = await validateUserApiKeys({ apiKeys: keysWithValues });
			setValidationResults(results.validationResults || {});
		} catch (error) {
			console.error('API key validation failed:', error);
			// Set error state for all keys
			const errorResults: Record<string, ValidationResult> = {};
			Object.keys(keysWithValues).forEach((key) => {
				errorResults[key] = {
					valid: false,
					platform: 'direct',
					errorMessage: getLangText(LANG_KEYS.VALIDATION_FAILED_NETWORK_ERROR),
				};
			});
			setValidationResults(errorResults);
		} finally {
			setIsValidatingApiKeys(false);
		}
	};

	// ✅ Validate on initial load
	useEffect(() => {
		if (userApiKeys && Object.keys(userApiKeys).length > 0) {
			validateApiKeys(userApiKeys);
		}
	}, [userApiKeys]);

	// ✅ Callback for re-validation after save
	const handleApiKeysUpdated = async (updatedKeys: UserApiKeys) => {
		await validateApiKeys(updatedKeys);
	};

	// Session
	const handleGoSession = (sessionId: string) => {
		navigate(`/${routeConstants.CHAT}/${sessionId}`);
	};

	// Avatar upload handler (similar to CharacterForm's handleImageUpload)
	const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		console.log('📁 File selected:', file?.name, file?.type, file?.size);

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			return addToast(getLangAlertText(LANG_KEYS.INVALID_FILE_TYPE), 'error');
		}
		if (file.size > LIMIT_5MB) {
			return addToast(getLangAlertText(LANG_KEYS.FILE_TOO_LARGE), 'error');
		}

		// Use FileReader instead of blob URL
		const reader = new FileReader();

		reader.onload = (e) => {
			const result = e.target?.result as string;
			console.log('📖 FileReader completed, data length:', result?.length);

			if (result) {
				setPendingAvatarFile(file);
				setModalImageUrl(result); // This will be a data: URL
				setCropModalOpen(true);
			}
		};

		reader.onerror = (error) => {
			console.error('❌ FileReader error:', error);
			addToast('Error reading image file', 'error');
		};

		console.log('📖 Starting FileReader...');
		reader.readAsDataURL(file); // Creates data:image/webp;base64,... URL

		// Clear the file input
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	// Simplify the crop complete handler since data URLs don't need cleanup
	const handleCropComplete = (croppedAreaPixels: any) => {
		if (!pendingAvatarFile || !modalImageUrl) {
			console.warn('⚠️ Missing data for crop completion');
			return;
		}

		const newAvatar: UploadedImage = {
			file: pendingAvatarFile,
			preview: modalImageUrl, // Keep the data: URL
			crop: croppedAreaPixels,
		};

		// Clean up previous avatar if it was a blob URL
		if (uploadedAvatar?.preview.startsWith('blob:')) {
			URL.revokeObjectURL(uploadedAvatar.preview);
		}

		setUploadedAvatar(newAvatar);
		setPendingAvatarFile(null);
		setCropModalOpen(false);
		setModalImageUrl('');

		addToast('Avatar ready for upload', 'success', 1500);
	};

	// Simplified modal close (no cleanup needed for data URLs)
	const handleModalClose = () => {
		setCropModalOpen(false);
		setPendingAvatarFile(null);
		setModalImageUrl('');
	};

	// Avatar upload function (similar to CharacterForm's uploadPortraits)
	const uploadAvatar = async (userId: string, avatar: UploadedImage): Promise<string> => {
		await createUserFolder({ userId });

		const formData = new FormData();
		formData.append('avatarFile', avatar.file!); // Note: field name is 'avatarFile' for user
		formData.append('userId', userId);

		// Add crop data if available
		if (avatar.crop) {
			formData.append('crop', JSON.stringify(avatar.crop));
		}

		const result = await uploadUserAvatar(formData);
		return result.avatarUrl;
	};

	// Submit handler (similar to CharacterForm's onSubmit)
	const onSubmit = async (formData: UserUdo) => {
		try {
			setIsUploading(true);
			console.log('📤 Starting submit with avatar:', {
				hasUploadedAvatar: !!uploadedAvatar,
				hasFile: !!uploadedAvatar?.file,
				previewUrl: uploadedAvatar?.preview,
			});

			let finalAvatarUrl = formData.avatarUrl;

			// Step 1: If there's a new avatar file, upload it first
			if (uploadedAvatar?.file) {
				console.log('📤 Uploading avatar...');
				finalAvatarUrl = await uploadAvatar(userInfo.userId, uploadedAvatar);
				console.log('✅ Avatar uploaded:', finalAvatarUrl);
				setValue('avatarUrl', finalAvatarUrl);

				// Clean up the preview URL after successful upload
				if (uploadedAvatar.preview.startsWith('blob:')) {
					URL.revokeObjectURL(uploadedAvatar.preview);
					console.log('🗑️ Cleaned up after upload');
				}
			}

			// Step 2: Save the user data
			const updateData: UserUdo = { ...formData, avatarUrl: finalAvatarUrl };

			await storeUser({ ...userInfo, ...updateData });
			console.log('✅ User data saved');

			// Step 3: Clean up and close edit mode
			setIsEditing(false);
			setUploadedAvatar(null);
		} catch (error: any) {
			console.error('❌ Submit error:', error);
			addToast(error.message || 'An error occurred while updating the profile.', 'error');
		} finally {
			setIsUploading(false);
		}
	};

	const handleCancelEdit = () => {
		reset(); // Revert changes to original values
		setUploadedAvatar(null);
		setIsEditing(false);

		// Clean up preview URL
		if (uploadedAvatar?.preview.startsWith('blob:')) {
			URL.revokeObjectURL(uploadedAvatar.preview);
		}
	};

	// Get current avatar source (uploaded preview or existing URL)
	const getCurrentAvatarSrc = () => {
		return uploadedAvatar?.preview || userInfo.avatarUrl;
	};

	return (
		<GlassPaper key="user-page" className="paper">
			<FormProvider {...methods}>
				<form onSubmit={handleSubmit(onSubmit)}>
					<Grid container spacing={containerSpacing}>
						{/* Main Profile Section */}
						<Grid size={{ xs: 12, md: 6 }}>
							<GlassCard variant="outlined" sx={{ mb: 2, position: 'relative' }}>
								{/* Edit/Save/Cancel Buttons */}
								{isMine && (
									<Box sx={{ position: 'absolute', top: 16, right: 16 }}>
										{isEditing ? (
											<Stack direction="row" spacing={1}>
												<Tooltip title={getLangText(LANG_KEYS.SAVE)}>
													<span>
														<IconButton type="submit" color="secondary" disabled={isSubmitting || isUploading}>
															{isSubmitting || isUploading ? <GlassCircularProgress /> : <SaveIcon />}
														</IconButton>
													</span>
												</Tooltip>
												<Tooltip title={getLangText(LANG_KEYS.CANCEL)}>
													<IconButton
														onClick={handleCancelEdit}
														color="secondary"
														disabled={isSubmitting || isUploading}
													>
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
								<Box
									display="flex"
									alignItems="center"
									gap={shouldUseMobileLayout ? 1.2 : 3}
									my={shouldUseMobileLayout ? 1.2 : 3}
									flexDirection={shouldUseMobileLayout ? 'column' : 'row'}
									sx={{
										width: '100%',
										maxWidth: '100%',
										overflow: 'hidden',
										textAlign: shouldUseMobileLayout ? 'center' : 'left',
									}}
								>
									<Box position="relative" sx={{ flexShrink: 0 }}>
										<Avatar
											src={getCurrentAvatarSrc()}
											alt={userInfo.showName}
											sx={{
												width: shouldUseMobileLayout ? 60 : 100,
												height: shouldUseMobileLayout ? 60 : 100,
												fontSize: shouldUseMobileLayout ? '1.1rem' : '2rem',
												...(getCurrentAvatarSrc() ? {} : { bgcolor: getGenderColor(userInfo.gender) }),
												opacity: isUploading ? 0.7 : 1,
											}}
										>
											{userInfo.showName.charAt(0).toUpperCase()}
										</Avatar>
										{isUploading && (
											<GlassCircularProgress
												size={shouldUseMobileLayout ? 60 : 100}
												sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
											/>
										)}
										{isEditing && !isUploading && (
											<IconButton
												component="label"
												sx={{
													position: 'absolute',
													bottom: 0,
													right: 0,
													bgcolor: 'rgba(0,0,0,0.6)',
													width: shouldUseMobileLayout ? 22 : 32,
													height: shouldUseMobileLayout ? 22 : 32,
													'&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
												}}
											>
												<PhotoCameraIcon
													sx={{ fontSize: shouldUseMobileLayout ? '0.7rem' : '1.2rem', color: 'white' }}
												/>
												<input
													type="file"
													ref={fileInputRef}
													hidden
													accept="image/*"
													onChange={handleAvatarUpload}
												/>
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
															disabled={isUploading}
														/>
													)}
												/>
												<Controller
													name="gender"
													control={control}
													render={({ field }) => (
														<FormControl fullWidth variant="standard">
															<InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel>
															<Select {...field} label={getLangText(LANG_KEYS.GENDER)} disabled={isUploading}>
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
												{/* Just the name first */}
												<Box display="flex" alignItems="center" gap={2} mb={1}>
													<RomanticTitle noGlow hover={false} variant="h4" component="h1" fontWeight="bold">
														{userInfo.showName}
													</RomanticTitle>
												</Box>

												{/* Entered date */}
												<Typography variant="body2" color="text.secondary" mb={1}>
													{`${getLangText(LANG_KEYS.ENTER_DATE)} : ${formatDate(userInfo.createdAt)}`}
												</Typography>

												{/* Gender chip below the date */}
												<Box>
													<Chip
														label={getLangText(genderToLangKey(userInfo.gender))}
														size="small" // Changed from medium to small for better proportion
														sx={{ bgcolor: getGenderColor(userInfo.gender), color: 'white', fontWeight: 'bold' }}
													/>
												</Box>
											</>
										)}
									</Box>
								</Box>

								<Divider sx={{ my: shouldUseMobileLayout ? 3 : 6 }} />

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
													render={({ field }) => (
														<TextField {...field} variant="standard" fullWidth disabled={isUploading} />
													)}
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
													render={({ field }) => (
														<TextField {...field} variant="standard" fullWidth disabled={isUploading} />
													)}
												/>
											) : (
												<Typography variant="body1">{userInfo.contact || 'N/A'}</Typography>
											)}
										</Box>
									</Box>
								</Stack>
							</GlassCard>
						</Grid>

						<Grid size={{ xs: 12, md: 6 }}>
							<GlassCard variant="outlined">
								<Typography variant="h6" fontWeight="bold" my={2}>
									{getLangText(LANG_KEYS.STATISTICS)}
								</Typography>
								<Stack spacing={2}>
									{/* My Characters */}
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<PeopleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
											<Typography variant="body2" color="text.secondary">
												{getLangText(LANG_KEYS.MY_CHARACTERS)}
											</Typography>
										</Stack>
										<Typography variant="h6" fontWeight="bold" color="secondary">
											{myCharacters.length}
										</Typography>
									</Box>

									{/* My Sessions */}
									<Box>
										<Box display="flex" justifyContent="space-between" alignItems="center">
											<Stack direction="row" spacing={1} alignItems="center">
												<ChatIcon fontSize="small" sx={{ color: 'text.secondary' }} />
												<Typography variant="body2" color="text.secondary">
													{getLangText(LANG_KEYS.MY_SESSIONS)}
												</Typography>
											</Stack>
											<Box display="flex" alignItems="center" gap={1}>
												{mySessions.length > 0 && (
													<IconButton
														size="small"
														onClick={() => setSessionsExpanded(!sessionsExpanded)}
														sx={{ color: 'text.secondary' }}
													>
														{sessionsExpanded ? <ExpandLess /> : <ExpandMore />}
													</IconButton>
												)}
												<Typography variant="h6" fontWeight="bold" color="secondary">
													{mySessions.length}
												</Typography>
											</Box>
										</Box>

										<Collapse in={sessionsExpanded} timeout="auto" unmountOnExit>
											<List dense className="hide-scrollbar" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
												{mySessions.slice(0, 5).map((session) => (
													<ListItem
														key={session.sessionId}
														sx={{ py: 0.5, px: 2, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
													>
														<ListItemButton onClick={() => handleGoSession(session.sessionId)}>
															<ListItemText
																primary={session.title || 'Untitled Session'}
																secondary={formatRelativeDate(session.updatedAt)}
																slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
															/>
														</ListItemButton>
													</ListItem>
												))}
												{mySessions.length > 5 && (
													<ListItem sx={{ py: 0.5, px: 2, justifyContent: 'center' }}>
														<Typography variant="caption" color="text.secondary">
															{`+${mySessions.length - 5} ${getLangText(LANG_KEYS.MORE)}`}
														</Typography>
													</ListItem>
												)}
											</List>
										</Collapse>
									</Box>

									{/* ✅ API Keys Section - Only for owner */}
									{isMine && (
										<Box>
											<Box display="flex" justifyContent="space-between" alignItems="center">
												<Stack direction="row" spacing={1} alignItems="center">
													<KeyIcon fontSize="small" sx={{ color: 'text.secondary' }} />
													<Typography variant="body2" color="text.secondary">
														{getLangText(LANG_KEYS.API_KEYS)}
													</Typography>
												</Stack>
												<Box display="flex" alignItems="center" gap={1}>
													<IconButton
														size="small"
														onClick={() => setApiKeysExpanded(!apiKeysExpanded)}
														sx={{ color: 'text.secondary' }}
													>
														{apiKeysExpanded ? <ExpandLess /> : <ExpandMore />}
													</IconButton>
													<Typography variant="h6" fontWeight="bold" color="secondary">
														{Object.values(userApiKeys || {}).filter((key) => key && key.trim() !== '').length}
													</Typography>
												</Box>
											</Box>

											<Collapse in={apiKeysExpanded} timeout="auto" unmountOnExit>
												<Box sx={{ mt: 1, px: 1 }}>
													<CredentialSection
														userId={userInfo.userId}
														userApiKeys={userApiKeys}
														validationResults={validationResults}
														isValidating={isValidatingApiKeys}
														onApiKeysUpdated={handleApiKeysUpdated}
													/>
												</Box>
											</Collapse>
										</Box>
									)}

									{/* Last Update Date */}
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<ScheduleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
											<Typography variant="body2" color="text.secondary">
												{`${getLangText(LANG_KEYS.LAST)} ${getLangText(LANG_KEYS.UPDATE_DATE)}`}
											</Typography>
										</Stack>
										<Typography variant="h6" color="secondary">
											{formatRelativeDate(userInfo.updatedAt)}
										</Typography>
									</Box>
								</Stack>
							</GlassCard>
						</Grid>
					</Grid>

					{/* Add the crop modal */}
					{pendingAvatarFile && modalImageUrl && (
						<ImageCropModal
							imageSrc={modalImageUrl} // Use the stored URL
							open={cropModalOpen}
							onClose={handleModalClose}
							onCropComplete={handleCropComplete}
							aspect={ASPECT_RATIOS.USER} // Square aspect ratio for user avatars
						/>
					)}
				</form>
			</FormProvider>
		</GlassPaper>
	);
};
