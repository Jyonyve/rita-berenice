// src/client/components/profile/ProfileCard.tsx

import React, { FC, useEffect, useState } from 'react';
import {
	Box,
	Button,
	Card,
	CardContent,
	CardActions,
	FormControl,
	InputLabel,
	MenuItem,
	Modal,
	Select,
	Stack,
	TextField,
	Typography,
	List,
	Grid,
} from '@mui/material';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { useForm, Controller } from 'react-hook-form';
import { getLangText } from '#shared/util/languageUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { GlassButton, GlassCard, GlassMetallicButton } from '../../layout/glass/index.js';
import { SolidMetallicButton } from '../../layout/index.js';
import { innerSpacing } from '../../style/index.js';

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
	position: 'absolute' as 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: { xs: '90%', sm: 600 },
	maxHeight: '80vh',
	overflowY: 'auto',
	bgcolor: 'background.paper',
	boxShadow: 24,
	borderRadius: 2,
};

export const ProfileCard: FC<{ userId: string; onSubmit: (profileData: ProfileCdo) => void }> = ({
	userId,
	onSubmit,
}) => {
	const {
		register,
		handleSubmit,
		control,
		setValue,
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
		setValue('name', profile.name);
		setValue('gender', profile.gender);
		setValue('title', profile.title);
		setValue('showName', profile.showName);
		setValue('description', profile.description);
		setValue('userId', userId);

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
						<TextField required fullWidth label="Profile Name" {...register('name')} />
						<TextField required fullWidth label="Display Name (in chat)" {...register('showName')} />

						{/* 2. Replace the Box with a Grid container */}
						<Grid container spacing={innerSpacing}>
							{/* Gender takes 3/12 width on medium screens */}
							<Grid size={{ xs: 12, md: 3 }}>
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
							{/* Title takes 9/12 width on medium screens */}
							<Grid size={{ xs: 12, md: 9 }}>
								<TextField
									required
									fullWidth
									label="Title or Role"
									placeholder="e.g., Crown Prince, Lead Researcher"
									{...register('title')}
								/>
							</Grid>
						</Grid>

						<TextField
							required
							fullWidth
							label="Description"
							multiline
							rows={4}
							placeholder="Describe the persona's background and key traits."
							{...register('description')}
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
