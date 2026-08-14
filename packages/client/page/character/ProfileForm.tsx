// src/client/components/profile/ProfileForm.tsx

import {
	Box,
	TextField,
	Button,
	Typography,
	Grid,
	FormControl,
	FormHelperText,
	InputLabel,
	List,
	MenuItem,
	Modal,
	Select,
	Stack,
	CardActions,
	FormControlLabel,
	Avatar,
} from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GlassButton, ImageCropModal, SolidMetallicButton } from '../../layout/component/index.js';
import { AdultSwitch } from '../../layout/component/AdultSwitch.js';
import { innerSpacing } from '../../style/index.js';
import { getGenderSelectLabel, getLangText } from '../../util/translateUtils.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { useResponsive } from '../../hook/useResponsive.js';
import {
	getImageInputAccept,
	LANG_KEYS,
	LIMIT_5MB,
	REQUEST_CHARACTER_LIMIT,
	SUPPORTED_IMAGE_MIMETYPES,
} from '@rita-berenice/shared/config';
import { ProfileInfo, ProfileCdo, SessionContentPolicy } from '@rita-berenice/shared/domain';
import { useProfileApi } from '../../hook/api/useProfileApi.js';
import { useToast } from '../../provider/ToastProvider.js';
import { cleanupBlobUrl, processCroppedImage } from '../../util/cropImageUtils.js';
import {
	getCharacterCropAspect,
	getCharacterCropOutputSize,
	type CharacterCropStage,
} from './characterImageCrop.js';

const modalStyle = {
	position: 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: { xs: '90%', sm: 600 },
	maxHeight: '80vh',
	overflowY: 'auto',
	bgcolor: 'background.paper',
	boxShadow: 24,
	borderRadius: 2,
	background: 'rgba(255,255,255,0.18)',
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	border: '1px solid rgba(255,255,255,0.22)',
	'&::-webkit-scrollbar': { display: 'none' },
	scrollbarWidth: 'none',
	msOverflowStyle: 'none',
};

const getInitialFormData = (userId: string, profile?: ProfileInfo): ProfileCdo => {
	if (profile) {
		return {
			name: profile.name,
			gender: profile.gender,
			title: profile.title,
			showName: profile.showName,
			description: profile.description,
			userId,
			sessionId: profile.sessionId || '',
		};
	}

	return {
		name: '',
		gender: 'other',
		title: '',
		showName: '',
		description: '',
		userId,
		sessionId: '',
	};
};

export interface ProfileFormProps {
	userId: string;
	mode: 'create' | 'edit';
	profile?: ProfileInfo; // Required for edit mode
	portraitUrl?: string;
	avatarUrl?: string;
	open?: boolean; // For modal mode (edit)
	onClose?: () => void; // For modal mode (edit)
	onSubmit: (
		profileData: ProfileCdo | ProfileInfo,
		contentPolicy?: SessionContentPolicy
	) => Promise<void>;
	showTemplateSelector?: boolean; // Only for create mode
}

export const ProfileForm: FC<ProfileFormProps> = ({
	userId,
	mode,
	profile,
	portraitUrl,
	avatarUrl,
	open = true, // Default true for inline usage
	onClose,
	onSubmit,
	showTemplateSelector = false,
}) => {
	const {
		handleSubmit,
		control,
		reset,
		formState: { isSubmitting, errors },
	} = useForm<ProfileCdo>({ defaultValues: getInitialFormData(userId, profile), mode: 'onBlur' });

	const { isSmallScreen } = useResponsive();
	const { addToast } = useToast();
	const { uploadProfileImage } = useProfileApi();
	const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
	const [contentPolicy, setContentPolicy] = useState<SessionContentPolicy>('general');
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [cropStage, setCropStage] = useState<CharacterCropStage>('portrait');
	const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
	const [pendingPortraitCrop, setPendingPortraitCrop] = useState<{
		file: File;
		previewUrl: string;
	} | null>(null);
	const [modalImageUrl, setModalImageUrl] = useState('');
	const [localPortraitUrl, setLocalPortraitUrl] = useState(portraitUrl);
	const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
	const [isUploadingImage, setIsUploadingImage] = useState(false);

	useEffect(() => {
		reset(getInitialFormData(userId, profile));
	}, [userId, profile, reset]);

	useEffect(() => {
		setLocalPortraitUrl(portraitUrl);
		setLocalAvatarUrl(avatarUrl);
	}, [portraitUrl, avatarUrl]);

	useEffect(() => () => cleanupBlobUrl(localPortraitUrl), [localPortraitUrl]);
	useEffect(() => () => cleanupBlobUrl(localAvatarUrl), [localAvatarUrl]);

	const handleOpenTemplateModal = () => setIsTemplateModalOpen(true);
	const handleCloseTemplateModal = () => setIsTemplateModalOpen(false);

	const handleClickProfile = (profileId: string) => {
		setSelectedTemplateId(profileId);
	};

	const handleDoubleClickProfile = (templateProfile: ProfileInfo) => {
		reset(getInitialFormData(userId, templateProfile));
		handleCloseTemplateModal();
	};

	const onFormSubmit = (data: ProfileCdo) => {
		onSubmit(data, mode === 'create' ? contentPolicy : undefined);
	};

	const resetCropFlow = () => {
		cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
		setPendingImageFile(null);
		setPendingPortraitCrop(null);
		setModalImageUrl('');
		setCropModalOpen(false);
		setCropStage('portrait');
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!SUPPORTED_IMAGE_MIMETYPES.includes(file.type as never)) {
			addToast('Unsupported image type.', 'error');
			return;
		}
		if (file.size > LIMIT_5MB) {
			addToast('Image must be 5 MB or smaller.', 'error');
			return;
		}

		const reader = new FileReader();
		reader.onload = ({ target }) => {
			if (typeof target?.result !== 'string') return;
			setPendingImageFile(file);
			setModalImageUrl(target.result);
			setCropStage('portrait');
			setCropModalOpen(true);
		};
		reader.onerror = () => addToast('Could not read the image.', 'error');
		reader.readAsDataURL(file);
	};

	const handleCropComplete = async (croppedBlob: Blob) => {
		if (!pendingImageFile || !profile?.profileId) return;
		const croppedImage = processCroppedImage(croppedBlob, pendingImageFile.name);

		if (cropStage === 'portrait') {
			cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
			setPendingPortraitCrop(croppedImage);
			setModalImageUrl(croppedImage.previewUrl);
			setCropStage('avatar');
			return;
		}

		if (!pendingPortraitCrop) throw new Error('Portrait crop is required before avatar crop.');
		setIsUploadingImage(true);
		try {
			const formData = new FormData();
			formData.append('image', pendingPortraitCrop.file);
			formData.append('avatar', croppedImage.file);
			formData.append('profileId', profile.profileId);
			await uploadProfileImage(formData);

			cleanupBlobUrl(localPortraitUrl);
			cleanupBlobUrl(localAvatarUrl);
			setLocalPortraitUrl(pendingPortraitCrop.previewUrl);
			setLocalAvatarUrl(croppedImage.previewUrl);
			setPendingPortraitCrop(null);
			addToast('Profile portrait and avatar saved.', 'success');
		} catch (error) {
			cleanupBlobUrl(croppedImage.previewUrl);
			cleanupBlobUrl(pendingPortraitCrop.previewUrl);
			setPendingPortraitCrop(null);
			addToast(error instanceof Error ? error.message : 'Could not save profile images.', 'error');
		} finally {
			setIsUploadingImage(false);
			setPendingImageFile(null);
			setModalImageUrl('');
			setCropModalOpen(false);
			setCropStage('portrait');
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	// Create the form content
	const formContent = (
		<Box component="form" onSubmit={handleSubmit(onFormSubmit)} noValidate>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					width: '100%',
					mb: 1,
				}}
			>
				<Typography
					variant="subtitle1"
					color="text.secondary"
					component="span" // Render as a <span> to be inline
					sx={{ whiteSpace: 'nowrap', mb: isSmallScreen ? 0 : 1 }}
				>
					{mode === 'create'
						? getLangText(LANG_KEYS.CREATE_NEW_PROFILE)
						: getLangText(LANG_KEYS.EDIT_PROFILE)}
				</Typography>

				{mode === 'create' && showTemplateSelector && (
					<GlassButton
						colorVariant="silver"
						variant="outlined"
						onClick={handleOpenTemplateModal}
						sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
					>
						{getLangText(LANG_KEYS.CHOOSE_EXISTING_PROFILE)}
					</GlassButton>
				)}
			</Box>

			<Stack spacing={innerSpacing}>
				{mode === 'edit' && profile && (
					<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
						<Box
							sx={{
								position: 'relative',
								width: { xs: 150, sm: 180 },
								aspectRatio: '5 / 7',
								borderRadius: 1.5,
								overflow: 'visible',
								border: '1px solid',
								borderColor: 'divider',
								bgcolor: 'rgba(0, 0, 0, 0.2)',
							}}
						>
							{localPortraitUrl ? (
								<Box
									component="img"
									src={localPortraitUrl}
									alt={`${profile.showName} portrait`}
									sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
								/>
							) : (
								<Box sx={{ width: '100%', height: '100%' }} />
							)}
							<Avatar
								src={localAvatarUrl}
								alt={`${profile.showName} avatar`}
								sx={{
									position: 'absolute',
									right: -8,
									bottom: -8,
									width: 52,
									height: 52,
									border: '2px solid',
									borderColor: 'background.paper',
								}}
							>
								{profile.showName.slice(0, 1)}
							</Avatar>
						</Box>
						<Button
							component="label"
							variant="outlined"
							startIcon={<CloudUpload />}
							disabled={isUploadingImage}
						>
							{isUploadingImage ? 'Saving image…' : 'Select profile image'}
							<input
								ref={fileInputRef}
								type="file"
								hidden
								accept={getImageInputAccept()}
								onChange={handleImageUpload}
							/>
						</Button>
					</Box>
				)}
				<Grid container spacing={innerSpacing}>
					<Grid size={{ xs: 12, md: 4 }}>
						<Controller
							name="showName"
							control={control}
							rules={{ required: getLangText(LANG_KEYS.SHOW_NAME_REQUIRED) }}
							render={({ field }) => (
								<TextField
									{...field}
									fullWidth
									label={getLangText(LANG_KEYS.SHOWNAME)}
									error={!!errors.showName}
									helperText={errors.showName?.message}
									placeholder={getLangText(LANG_KEYS.SHOW_NAME_PLACEHOLDER)}
									required
								/>
							)}
						/>
					</Grid>
					<Grid size={{ xs: 12, md: 8 }}>
						<Controller
							name="name"
							control={control}
							rules={{ required: getLangText(LANG_KEYS.NAME_REQUIRED) }}
							render={({ field }) => (
								<TextField
									{...field}
									fullWidth
									label={getLangText(LANG_KEYS.NAME)}
									error={!!errors.name}
									helperText={errors.name?.message}
									placeholder={getLangText(LANG_KEYS.NAME_PLACEHOLDER)}
									required
								/>
							)}
						/>
					</Grid>
				</Grid>
				<Grid container spacing={innerSpacing}>
					<Grid size={{ xs: 12, md: 4 }}>
						<FormControl fullWidth required>
							<Controller
								name="gender"
								control={control}
								rules={{ required: getLangText(LANG_KEYS.GENDER_REQUIRED) }}
								render={({ field }) => (
									<FormControl fullWidth required error={!!errors.gender}>
										{/* <InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel> */}
										<Select {...field}>
											{getGenderSelectLabel().map((opt) => (
												<MenuItem key={opt.key} value={opt.key}>
													{opt.label}
												</MenuItem>
											))}
										</Select>
										{errors.gender && <FormHelperText>{errors.gender.message}</FormHelperText>}
									</FormControl>
								)}
							/>
						</FormControl>
					</Grid>
					<Grid size={{ xs: 12, md: 8 }}>
						<Controller
							name="title"
							control={control}
							rules={{ required: getLangText(LANG_KEYS.TITLE_REQUIRED) }}
							render={({ field }) => (
								<TextField
									{...field}
									fullWidth
									label={getLangText(LANG_KEYS.TITLE)}
									error={!!errors.title}
									helperText={errors.title?.message}
									placeholder={getLangText(LANG_KEYS.TITLE_PLACEHOLDER)}
									required
									slotProps={{ htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT } }}
								/>
							)}
						/>
					</Grid>
				</Grid>

				<Controller
					name="description"
					control={control}
					rules={{ required: getLangText(LANG_KEYS.DESCRIPTION_REQUIRED) }}
					render={({ field }) => (
						<TextField
							{...field}
							fullWidth
							label={getLangText(LANG_KEYS.DESCRIPTION)}
							multiline
							minRows={3}
							maxRows={10}
							error={!!errors.description}
							helperText={errors.description?.message || getLangText(LANG_KEYS.DESCRIPTION_HELPER)}
							placeholder={getLangText(LANG_KEYS.DESCRIPTION_PLACEHOLDER)}
							required
						/>
					)}
				/>
			</Stack>

			<CardActions sx={{ justifyContent: 'space-between', alignItems: 'flex-start', px: 0 }}>
				{mode === 'create' && (
					<Box
						sx={{
							display: 'flex',
							flexDirection: { xs: 'column', sm: 'row' },
							alignItems: { xs: 'stretch', sm: 'center' },
							gap: 1,
							minWidth: 0,
							width: '100%',
						}}
					>
						<TextField fullWidth label={getLangText(LANG_KEYS.SESSION_TITLE)} />
						<FormControlLabel
							control={
								<AdultSwitch
									checked={contentPolicy === 'adult'}
									onChange={(_, checked) => setContentPolicy(checked ? 'adult' : 'general')}
									inputProps={{ 'aria-label': getLangText(LANG_KEYS.ADULT_SESSION) }}
								/>
							}
							label={getLangText(LANG_KEYS.ADULT_SESSION)}
							sx={{ m: 0, flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
						/>
					</Box>
				)}

				<>
					{mode === 'edit' && onClose && (
						<Button variant="outlined" onClick={onClose} disabled={isSubmitting} sx={{ mr: 1 }}>
							{getLangText(LANG_KEYS.CANCEL)}
						</Button>
					)}
					<SolidMetallicButton
						colorVariant="gold"
						type="submit"
						variant="outlined"
						disabled={isSubmitting}
						sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
					>
						{mode === 'create' ? getLangText(LANG_KEYS.START_NEW_SESSION) : getLangText(LANG_KEYS.UPDATE)}
					</SolidMetallicButton>
				</>
			</CardActions>

			{/* Template Selection Modal - Only for create mode */}
			{mode === 'create' && showTemplateSelector && (
				<Modal open={isTemplateModalOpen} onClose={handleCloseTemplateModal}>
					<Box sx={modalStyle}>
						<Typography variant="h6" gutterBottom>
							{getLangText(LANG_KEYS.CHOOSE_EXISTING_PROFILE)}
						</Typography>
						<List>
							<ProfilePreviewList
								userId={userId}
								selectedProfileId={selectedTemplateId}
								onClickProfile={handleClickProfile}
								onDoubleClickProfile={handleDoubleClickProfile}
							/>
						</List>
						<Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
							<Button onClick={handleCloseTemplateModal}>{getLangText(LANG_KEYS.CANCEL)}</Button>
						</Box>
					</Box>
				</Modal>
			)}

			{pendingImageFile && modalImageUrl && (
				<ImageCropModal
					imageSrc={modalImageUrl}
					open={cropModalOpen}
					onClose={resetCropFlow}
					onCropComplete={handleCropComplete}
					aspect={getCharacterCropAspect(cropStage)}
					outputSize={getCharacterCropOutputSize(cropStage)}
					title={cropStage === 'portrait' ? 'Crop profile portrait' : 'Crop profile avatar'}
				/>
			)}
		</Box>
	);

	// Render as modal for edit mode, inline for create mode
	if (mode === 'edit') {
		const handleModalClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
			// This will prevent the modal from closing when the backdrop is clicked
			if (reason && reason === 'backdropClick') {
				return;
			}

			if (onClose) {
				onClose();
			}
		};

		return (
			<Modal open={open || false} onClose={handleModalClose} disableEscapeKeyDown>
				<Box sx={{ ...modalStyle, p: 1 }}> {formContent}</Box>
			</Modal>
		);
	}

	// Render inline for create mode
	return formContent;
};
