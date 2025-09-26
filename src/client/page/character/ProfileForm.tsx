// src/client/components/profile/ProfileForm.tsx

import { LANG_KEYS } from '#shared/config/langConstants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/profile.type.js';
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
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GlassButton, GlassCard, SolidMetallicButton } from '../../layout/index.js';
import { innerSpacing } from '../../style/index.js';
import { getGenderSelectLabel, getLangText } from '../../util/translateUtils.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { useResponsive } from '../../hook/useResponsive.js';

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
	open?: boolean; // For modal mode (edit)
	onClose?: () => void; // For modal mode (edit)
	onSubmit: (profileData: ProfileCdo | ProfileInfo) => Promise<void>;
	showTemplateSelector?: boolean; // Only for create mode
}

export const ProfileForm: FC<ProfileFormProps> = ({
	userId,
	mode,
	profile,
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
	const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

	useEffect(() => {
		reset(getInitialFormData(userId, profile));
	}, [userId, profile, reset]);

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
		onSubmit(data);
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
				<Grid container spacing={innerSpacing}>
					<Grid size={{ xs: 12, md: 4 }}>
						<Controller
							name="showName"
							disabled={mode === 'edit'}
							control={control}
							rules={{ required: getLangText(LANG_KEYS.SHOW_NAME_REQUIRED) }}
							render={({ field }) => (
								<TextField
									{...field}
									fullWidth
									disabled={mode === 'edit'}
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
							disabled={mode === 'edit'}
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
								disabled={mode === 'edit'}
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

			<CardActions sx={{ justifyContent: 'space-between', px: 0 }}>
				{mode === 'create' && <TextField fullWidth label={getLangText(LANG_KEYS.SESSION_TITLE)} />}

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
