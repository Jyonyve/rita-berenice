// src/client/components/profile/ProfileCard.tsx

import { LANG_KEYS, LangKey } from '#shared/config/langConstants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import {
	Box,
	CardActions,
	FormControl,
	FormHelperText,
	Grid,
	InputLabel,
	List,
	MenuItem,
	Modal,
	Select,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GlassButton, GlassCard } from '../../layout/glass/index.js';
import { GlassSelect, SolidMetallicButton } from '../../layout/index.js';
import { innerSpacing } from '../../style/index.js';
import { GENDER_SELECT_MENUITEM, getLangText } from '../../util/translateUtils.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';

const getInitialFormData = (userId: string): ProfileCdo => ({
	name: '',
	gender: '',
	title: '',
	showName: '',
	description: '',
	userId,
	sessionId: '',
});

const modalStyle = {
	position: 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: { xs: '90%', sm: 600 },
	maxHeight: '80vh',
	overflowY: 'auto',
	bgcolor: 'background.paper', // This can be replaced or extended
	boxShadow: 24,
	borderRadius: 2,
	// Add these styles for a glassy, visible background:
	background: 'rgba(255,255,255,0.18)', // Slight white tint, adjust alpha as needed
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	border: '1px solid rgba(255,255,255,0.22)',
	'&::-webkit-scrollbar': {
		display: 'none', // Hide scrollbar for Chrome, Safari, and Edge
	},
	scrollbarWidth: 'none', // Hide scrollbar for Firefox
	msOverflowStyle: 'none', // Hide scrollbar for Internet Explorer
};

export const ProfileForm: FC<{ userId: string; onSubmit: (profileData: ProfileCdo) => void }> = ({
	userId,
	onSubmit,
}) => {
	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { isSubmitting, errors },
	} = useForm<ProfileCdo>({ defaultValues: getInitialFormData(userId), mode: 'onBlur' });

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

	useEffect(() => {
		reset(getInitialFormData(userId));
	}, [userId, reset]);

	const handleOpenModal = () => setIsModalOpen(true);
	const handleCloseModal = () => setIsModalOpen(false);

	// --- MODIFIED BEHAVIOR ---

	// On single click, just set the ID to highlight the item in the list.
	const handleClickProfile = (profileId: string) => {
		setSelectedTemplateId(profileId);
	};

	// On double click, populate the form with the profile's data and close the modal.
	const handleDoubleClickProfile = (profile: ProfileInfo) => {
		reset({
			name: profile.name,
			gender: profile.gender,
			title: profile.title,
			showName: profile.showName,
			description: profile.description,
			userId,
			sessionId: '',
		});
		handleCloseModal();
	};

	const onFormSubmit = (data: ProfileCdo) => {
		onSubmit(data);
	};

	return (
		<>
			<GlassCard variant="outlined">
				<Box component="form" onSubmit={handleSubmit(onFormSubmit)} noValidate>
					<Box
						sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
						mb={1}
					>
						<Typography variant="subtitle1" color="text.secondary" mb={1}>
							{getLangText(LANG_KEYS.CREATE_NEW_PROFILE)}
						</Typography>
						<GlassButton colorVariant="silver" variant="outlined" onClick={handleOpenModal}>
							{getLangText(LANG_KEYS.CHOOSE_EXISTING_PROFILE)}
						</GlassButton>
					</Box>

					<Stack spacing={1}>
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
								{/* Your existing Controller for Select is already correct */}
								<FormControl fullWidth required>
									<Controller
										name="gender"
										control={control}
										rules={{ required: getLangText(LANG_KEYS.GENDER_REQUIRED) }}
										render={({ field }) => (
											<FormControl fullWidth required error={!!errors.gender}>
												<InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel>
												<Select {...field}>
													{GENDER_SELECT_MENUITEM.map((opt) => (
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
								{/* --- UPDATED TEXTFIELD --- */}
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

						{/* --- UPDATED TEXTFIELD --- */}
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
					<CardActions sx={{ justifyContent: 'flex-end', p: 2, pb: 0 }}>
						<SolidMetallicButton
							colorVariant="gold"
							type="submit"
							variant="outlined"
							disabled={isSubmitting}
						>
							{getLangText(LANG_KEYS.START_NEW_SESSION)}
						</SolidMetallicButton>
					</CardActions>
				</Box>
			</GlassCard>

			<Modal open={isModalOpen} onClose={handleCloseModal}>
				<Box sx={modalStyle}>
					<List>
						<ProfilePreviewList
							userId={userId}
							selectedProfileId={selectedTemplateId}
							onClickProfile={handleClickProfile}
							onDoubleClickProfile={handleDoubleClickProfile}
						/>
					</List>
				</Box>
			</Modal>
		</>
	);
};
