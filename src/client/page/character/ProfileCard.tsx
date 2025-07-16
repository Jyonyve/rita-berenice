// src/client/components/profile/ProfileCard.tsx

import { LANG_KEYS } from '#shared/config/langConstants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import {
	Box,
	CardActions,
	FormControl,
	Grid,
	InputLabel,
	List,
	MenuItem,
	Modal,
	Select,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GlassButton, GlassCard } from '../../layout/glass/index.js';
import { SolidMetallicButton } from '../../layout/index.js';
import { innerSpacing } from '../../style/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';

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
};

export const ProfileCard: FC<{ userId: string; onSubmit: (profileData: ProfileCdo) => void }> = ({
	userId,
	onSubmit,
}) => {
	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { isSubmitting },
	} = useForm<ProfileCdo>({ defaultValues: getInitialFormData(userId) });

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
						{/* --- UPDATED TEXTFIELDS --- */}
						<Controller
							name="name"
							control={control}
							render={({ field }) => <TextField required fullWidth label="Profile Name" {...field} />}
						/>
						<Controller
							name="showName"
							control={control}
							render={({ field }) => (
								<TextField required fullWidth label="Display Name (in chat)" {...field} />
							)}
						/>

						<Grid container spacing={innerSpacing}>
							<Grid size={{ xs: 12, md: 3 }}>
								{/* Your existing Controller for Select is already correct */}
								<FormControl fullWidth required>
									<InputLabel id="gender-select-label">{getLangText(LANG_KEYS.GENDER)}</InputLabel>
									<Controller
										name="gender"
										control={control}
										render={({ field }) => (
											<Select labelId="gender-select-label" label="Gender" {...field}>
												<MenuItem value="male">{getLangText(LANG_KEYS.MALE)}</MenuItem>
												<MenuItem value="female">{getLangText(LANG_KEYS.FEMALE)}</MenuItem>
												<MenuItem value="other">{getLangText(LANG_KEYS.OTHER)}</MenuItem>
											</Select>
										)}
									/>
								</FormControl>
							</Grid>
							<Grid size={{ xs: 12, md: 9 }}>
								{/* --- UPDATED TEXTFIELD --- */}
								<Controller
									name="title"
									control={control}
									render={({ field }) => (
										<TextField
											required
											fullWidth
											label="Title or Role"
											placeholder="e.g., Crown Prince, Lead Researcher"
											{...field}
										/>
									)}
								/>
							</Grid>
						</Grid>

						{/* --- UPDATED TEXTFIELD --- */}
						<Controller
							name="description"
							control={control}
							render={({ field }) => (
								<TextField
									required
									fullWidth
									label="Description"
									multiline
									rows={4}
									placeholder="Describe the persona's background and key traits."
									{...field}
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
