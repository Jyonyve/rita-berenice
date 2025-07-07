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
} from '@mui/material';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { useForm, Controller } from 'react-hook-form';

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
			<Card variant="outlined">
				<Box component="form" onSubmit={handleSubmit(onFormSubmit)} noValidate>
					<CardContent>
						<Typography variant="h5" component="h2" gutterBottom>
							Create New Profile
						</Typography>

						<Stack spacing={2}>
							<Button variant="outlined" onClick={handleOpenModal} fullWidth>
								Choose from Existing Profile as Template
							</Button>

							<TextField required fullWidth label="Profile Name" {...register('name')} />
							<TextField required fullWidth label="Display Name (in chat)" {...register('showName')} />
							<TextField
								required
								fullWidth
								label="Title or Role"
								placeholder="e.g., Crown Prince, Lead Researcher"
								{...register('title')}
							/>
							<FormControl fullWidth required>
								<InputLabel id="gender-select-label">Gender</InputLabel>
								<Controller
									name="gender"
									control={control}
									render={({ field }) => (
										<Select labelId="gender-select-label" label="Gender" {...field}>
											<MenuItem value="male">Male</MenuItem>
											<MenuItem value="female">Female</MenuItem>
											<MenuItem value="non-binary">Non-binary</MenuItem>
											<MenuItem value="other">Other</MenuItem>
										</Select>
									)}
								/>
							</FormControl>
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
					</CardContent>
					<CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
						<Button type="submit" variant="contained" disabled={isSubmitting}>
							Create Profile
						</Button>
					</CardActions>
				</Box>
			</Card>

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
