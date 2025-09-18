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
	CloudUpload,
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
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { UserInfo, UserUdo } from '#shared/domain/user/UserInterfaces.js';
import { ASPECT_RATIOS, GENDER_OPTION, LIMIT_5MB } from '#shared/config/constants.js';
import { CharacterInfo } from '#shared/domain/character/index.js';
import { useDateFormatter } from '../../hook/index.js';
import { useUserApi } from '../../hook/api/index.js';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { UploadedImage } from '#shared/domain/image/index.js';
import { ImageCropModal } from '../../layout/index.js';

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
	isOwnProfile: boolean;
}> = ({ userInfo, myCharacters, mySessions, isOwnProfile }) => {
	const { formatDate, formatRelativeDate } = useDateFormatter();
	const { addToast } = useToast();
	const { storeUser, uploadUserAvatar, createUserFolder } = useUserApi();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [isEditing, setIsEditing] = useState(false);
	const [isUploading, setIsUploading] = useState(false);

	// Avatar states similar to CharacterForm's image states
	const [uploadedAvatar, setUploadedAvatar] = useState<UploadedImage | null>(null);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
	const [modalImageUrl, setModalImageUrl] = useState<string>('');

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
	}, []); // Empty dependency array - only run on unmount

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

		try {
			// Create the preview URL once and store it
			const previewUrl = URL.createObjectURL(file);
			console.log('🖼️ Created blob URL:', previewUrl);

			setModalImageUrl(previewUrl);
			setPendingAvatarFile(file);
			setCropModalOpen(true);

			// Clear the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		} catch (error) {
			console.error('❌ Error creating object URL:', error);
			addToast('Error loading image', 'error');
		}
	};

	// Crop completion handler (similar to CharacterForm's handleCropComplete)
	const handleCropComplete = (croppedAreaPixels: any) => {
		console.log('✂️ Crop completed:', croppedAreaPixels);

		if (!pendingAvatarFile) {
			console.warn('⚠️ No pending file found');
			return;
		}

		const newAvatar: UploadedImage = {
			file: pendingAvatarFile,
			preview: modalImageUrl, // Use the existing URL
			crop: croppedAreaPixels,
		};

		console.log('📸 New avatar created:', {
			hasFile: !!newAvatar.file,
			previewUrl: newAvatar.preview,
			hasCrop: !!newAvatar.crop,
		});

		// Clean up previous avatar preview
		if (uploadedAvatar?.preview.startsWith('blob:')) {
			URL.revokeObjectURL(uploadedAvatar.preview);
			console.log('🗑️ Cleaned up previous avatar URL');
		}

		setUploadedAvatar(newAvatar);
		setPendingAvatarFile(null);
		setCropModalOpen(false);
		// Don't clear modalImageUrl yet - we're still using it

		addToast(getLangText(LANG_KEYS.SAVE_SUCCESS), 'success', 1500);
	};

	const handleModalClose = () => {
		console.log('❌ Modal closing, cleaning up');
		setCropModalOpen(false);
		setPendingAvatarFile(null);

		// Clean up the modal image URL
		if (modalImageUrl) {
			URL.revokeObjectURL(modalImageUrl);
			console.log('🗑️ Cleaned up modal URL:', modalImageUrl);
			setModalImageUrl('');
		}
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
						<Grid size={{ xs: 12, md: 8 }}>
							<GlassCard variant="outlined" sx={{ mb: 2, position: 'relative' }}>
								{/* Edit/Save/Cancel Buttons */}
								{isOwnProfile && (
									<Box sx={{ position: 'absolute', top: 16, right: 16 }}>
										{isEditing ? (
											<Stack direction="row" spacing={1}>
												<Tooltip title={getLangText(LANG_KEYS.SAVE)}>
													<span>
														<IconButton type="submit" color="primary" disabled={isSubmitting || isUploading}>
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
								<Box display="flex" alignItems="center" gap={3} my={3}>
									<Box position="relative">
										<Avatar
											src={getCurrentAvatarSrc()}
											alt={userInfo.showName}
											sx={{
												width: 100,
												height: 100,
												fontSize: '2rem',
												bgcolor: getGenderColor(userInfo.gender),
												opacity: isUploading ? 0.7 : 1,
											}}
										>
											{userInfo.showName.charAt(0).toUpperCase()}
										</Avatar>
										{isUploading && (
											<GlassCircularProgress
												size={100}
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
													'&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
												}}
											>
												<PhotoCameraIcon sx={{ fontSize: '1.2rem', color: 'white' }} />
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
													<Typography variant="h4" component="h1" fontWeight="bold">
														{userInfo.showName}
													</Typography>
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

						{/* Sidebar - Statistics remain unchanged */}
						<Grid size={{ xs: 12, md: 4 }}>
							<GlassCard variant="outlined">
								<Typography variant="h6" fontWeight="bold" my={2}>
									{getLangText(LANG_KEYS.STATISTICS)}
								</Typography>
								<Stack spacing={2}>
									<Box display="flex" justifyContent="space-between" alignItems="center">
										<Stack direction="row" spacing={1} alignItems="center">
											<PeopleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
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
											<ChatIcon fontSize="small" sx={{ color: 'text.secondary' }} />
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
											<ScheduleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
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
