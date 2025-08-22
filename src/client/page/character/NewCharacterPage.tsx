import { LANG_KEYS } from '#shared/config/langConstants.js';
import { CharacterCdo } from '#shared/domain/character/CharacterInterfaces.js';
import {
	Box,
	Grid,
	Typography,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	SelectChangeEvent,
	FormHelperText,
	Chip,
	Stack,
	Alert,
} from '@mui/material';
import { FC, useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { CloudUpload } from '@mui/icons-material';
import { useCharacterApi } from '../../hook/api/index.js';
import {
	GlassButton,
	GlassCard,
	GlassPaper,
	GlassPortraitSlider,
	GlassSelect,
} from '../../layout/glass/index.js';
import { RomanticTitle } from '../../layout/RomanticTitle.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { useToast } from '../../provider/ToastProvider.jsx';
import { routeConstants } from '../../routeConstants.js';
import { containerSpacing } from '../../style/index.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { EMOTION_CATEGORY_NAMES } from '#shared/util/emotionUtils.js';
import { BASE_IMAGE_DIR, LIMIT_5MB } from '#shared/config/constants.js';

// Gender options
const GENDER_OPTIONS = [
	{ key: 'male', label: 'Male' },
	{ key: 'female', label: 'Female' },
	{ key: 'non-binary', label: 'Non-binary' },
	{ key: 'other', label: 'Other' },
];

// Convert to options array for the select box
const EMOTION_OPTIONS = Object.entries(EMOTION_CATEGORY_NAMES).map(([key, value]) => ({
	key: value,
	label: value.charAt(0).toUpperCase() + value.slice(1),
	emotionKey: parseInt(key),
}));

interface UploadedImage {
	file: File;
	emotion: string;
	emotionKey: number;
	preview: string;
}

const NewCharacterPage: FC<{ userId: string }> = ({ userId }) => {
	const { openLoginModal } = useAuth();
	const navigate = useNavigate();
	const { addToast } = useToast();
	const { storeCharacter, uploadCharacterImage, createCharacterFolder } = useCharacterApi();

	// File input ref
	const fileInputRef = useRef<HTMLInputElement>(null);

	// React Hook Form setup
	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
	} = useForm<CharacterCdo>({
		defaultValues: {
			title: '',
			contact: '',
			description: '',
			instruction: '',
			gender: '',
			name: '',
			showName: '',
			userId: userId,
			firstMessage: '',
		},
		mode: 'onBlur',
	});

	// Image upload state
	const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
	const [selectedEmotion, setSelectedEmotion] = useState<string>(DEFAULT_EMOTION);
	const [alertMessage, setAlertMessage] = useState<{
		message: string;
		severity: 'success' | 'error' | 'info' | 'warning';
	}>();

	// Get emotion key from emotion name
	const getEmotionKey = (emotionName: string): number => {
		const entry = Object.entries(EMOTION_CATEGORY_NAMES).find(
			([key, value]) => value === emotionName
		);
		return entry ? parseInt(entry[0]) : 0;
	};

	// Handlers
	const handleEmotionChange = (event: any) => {
		setSelectedEmotion(event.target.value);
	};

	const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type
		if (!file.type.startsWith('image/')) {
			setAlertMessage({
				message: 'Invalid file type. Please upload an image file.',
				severity: 'error',
			});
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > LIMIT_5MB) {
			setAlertMessage({
				message: 'File too large. Please upload an image smaller than 5MB.',
				severity: 'error',
			});
			return;
		}

		// Check if emotion already has an image
		const existingImageIndex = uploadedImages.findIndex((img) => img.emotion === selectedEmotion);

		const preview = URL.createObjectURL(file);
		const emotionKey = getEmotionKey(selectedEmotion);
		const newImage: UploadedImage = { file, emotion: selectedEmotion, emotionKey, preview };

		if (existingImageIndex >= 0) {
			// Replace existing image for this emotion
			setUploadedImages((prev) => {
				const newImages = [...prev];
				URL.revokeObjectURL(newImages[existingImageIndex].preview);
				newImages[existingImageIndex] = newImage;
				return newImages;
			});
		} else {
			// Add new image
			setUploadedImages((prev) => [...prev, newImage]);
		}

		// Reset file input
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}

		setAlertMessage({
			message: `Image uploaded for ${selectedEmotion} emotion!`,
			severity: 'success',
		});
	};

	const handleRemoveImage = (emotion: string) => {
		setUploadedImages((prev) => {
			const imageToRemove = prev.find((img) => img.emotion === emotion);
			if (imageToRemove) {
				URL.revokeObjectURL(imageToRemove.preview);
			}
			return prev.filter((img) => img.emotion !== emotion);
		});
	};

	// Convert and save images to the asset directory
	const saveCharacterImages = async (
		characterId: string,
		images: UploadedImage[]
	): Promise<void> => {
		const savePromises = images.map(async (image) => {
			return new Promise<void>((resolve, reject) => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				const img = new Image();

				img.onload = () => {
					canvas.width = img.width;
					canvas.height = img.height;

					if (ctx) {
						ctx.drawImage(img, 0, 0);

						// Convert to WebP format
						canvas.toBlob(
							async (blob) => {
								if (blob) {
									try {
										const fileName = `${characterId}_${image.emotion}.webp`;
										const filePath = `${BASE_IMAGE_DIR}/${characterId}/${fileName}`;

										// Create directory if it doesn't exist
										// In a real implementation, you'd use Node.js fs API or a file upload service
										// For now, this is a placeholder for the file saving logic

										// Create a download link for the converted image (for demonstration)
										const url = URL.createObjectURL(blob);
										const a = document.createElement('a');
										a.href = url;
										a.download = fileName;
										document.body.appendChild(a);
										a.click();
										document.body.removeChild(a);
										URL.revokeObjectURL(url);

										resolve();
									} catch (error) {
										reject(error);
									}
								} else {
									reject(new Error('Failed to convert image to WebP'));
								}
							},
							'image/webp',
							0.9
						);
					}
				};

				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = image.preview;
			});
		});

		await Promise.all(savePromises);
	};

	const uploadCharacterImages = async (
		characterId: string,
		images: UploadedImage[]
	): Promise<void> => {
		try {
			await createCharacterFolder({ characterId });

			await Promise.all(
				images.map(async (image) => {
					const formData = new FormData();
					formData.append('image', image.file);
					formData.append('characterId', characterId);
					formData.append('emotion', image.emotion);

					await uploadCharacterImage(formData);
				})
			);

			console.log(`Successfully uploaded ${images.length} images for character ${characterId}`);
		} catch (error) {
			console.error('Error uploading images:', error);
			throw error;
		}
	};

	// ✅ UPDATED: Form submission handler
	const onSubmit = async (data: CharacterCdo) => {
		try {
			// Create character first
			const response = await storeCharacter(data);
			if (!!response) {
				const characterId: string = JSON.parse(response).characterId;

				// Upload images using API if any
				if (uploadedImages.length > 0) {
					await uploadCharacterImages(characterId, uploadedImages);
				}

				setAlertMessage({
					message: getLangAlertText(LANG_KEYS.CHARACTER_CREATED_SUCCESS),
					severity: 'success',
				});

				// Navigate after a short delay to show the success message
				setTimeout(() => {
					navigate(`/${routeConstants.CHARACTER}/${characterId}`);
				}, 1500);
			} else {
				throw new Error('Failed to create character');
			}
		} catch (error) {
			console.error('Error creating character:', error);
			setAlertMessage({ message: 'Error creating character. Please try again.', severity: 'error' });
		}
	};

	// Get preview images for the slider
	const getPreviewImages = (): string[] => {
		return uploadedImages.map((img) => img.preview);
	};

	return (
		<GlassPaper key="new-character-page" className="paper">
			<form onSubmit={handleSubmit(onSubmit)}>
				<Grid container spacing={containerSpacing}>
					{/* Left Column - Image Preview */}
					<Grid
						size={{ xs: 12, md: 4 }}
						sx={{
							position: { xs: 'static', md: 'sticky' },
							top: (theme) => theme.spacing(2),
							alignSelf: 'flex-start',
							height: {
								xs: 'auto',
								md: (theme) =>
									`calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
							},
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
							{/* Alert Messages */}
							{alertMessage && (
								<Alert
									severity={alertMessage.severity}
									onClose={() => setAlertMessage(undefined)}
									sx={{ mb: 2 }}
								>
									{alertMessage.message}
								</Alert>
							)}

							{/* Image Preview */}
							<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								{uploadedImages.length > 0 ? (
									<GlassPortraitSlider imageUrls={getPreviewImages()} />
								) : (
									<Box
										width="100%"
										height={300}
										bgcolor="rgba(255,255,255,0.1)"
										borderRadius={3}
										display="flex"
										alignItems="center"
										justifyContent="center"
										border="2px dashed rgba(255,255,255,0.3)"
									>
										<Typography variant="body2" color="text.secondary" textAlign="center">
											{getLangText(LANG_KEYS.NO_IMAGES)}
										</Typography>
									</Box>
								)}
							</Box>

							{/* Upload Controls */}
							<GlassCard variant="outlined" sx={{ p: 2 }}>
								<Typography variant="subtitle2" mb={2}>
									{getLangText(LANG_KEYS.PORTRAIT)}
								</Typography>

								<FormControl fullWidth size="small" sx={{ mb: 2 }}>
									<InputLabel>Emotion</InputLabel>
									<GlassSelect
										value={selectedEmotion}
										onChange={handleEmotionChange}
										label={getLangText(LANG_KEYS.EMOTION)}
									>
										{EMOTION_OPTIONS.map((option) => (
											<MenuItem key={option.key} value={option.key}>
												{option.label}
											</MenuItem>
										))}
									</GlassSelect>
								</FormControl>

								<input
									type="file"
									ref={fileInputRef}
									onChange={handleImageUpload}
									accept="image/webp,image/avif,image/jpeg,image/png"
									style={{ display: 'none' }}
								/>

								<GlassButton
									fullWidth
									startIcon={<CloudUpload />}
									onClick={() => fileInputRef.current?.click()}
									colorVariant="primary"
									sx={{ mb: 2 }}
									type="button"
								>
									Upload Image for {EMOTION_OPTIONS.find((e) => e.key === selectedEmotion)?.label}
								</GlassButton>

								{/* Uploaded Images List */}
								{uploadedImages.length > 0 && (
									<Stack direction="row" flexWrap="wrap" gap={1}>
										{uploadedImages.map((img) => (
											<Chip
												key={img.emotion}
												label={`${EMOTION_OPTIONS.find((e) => e.key === img.emotion)?.label} (${img.emotionKey})`}
												onDelete={() => handleRemoveImage(img.emotion)}
												color="primary"
												variant="outlined"
												size="small"
											/>
										))}
									</Stack>
								)}
							</GlassCard>
						</Box>
					</Grid>

					{/* Right Column - Character Form */}
					<Grid size={{ xs: 12, md: 8 }}>
						<Box display="flex" flexDirection="column" gap={3}>
							{/* Header */}
							<GlassCard variant="outlined">
								<RomanticTitle noGlow hover variant="h4" color="primary" sx={{ mb: 1 }}>
									{getLangText(LANG_KEYS.NEW_CHARACTER)}
								</RomanticTitle>
								<Typography variant="body2" color="text.secondary">
									Fill in the details below to create a new character for your collection.
								</Typography>
							</GlassCard>

							{/* Basic Information */}
							<GlassCard variant="outlined">
								<Typography variant="h6" color="primary" gutterBottom>
									{getLangText(LANG_KEYS.BASIC_INFO)}
								</Typography>

								<Grid container spacing={2}>
									<Grid size={{ xs: 12, sm: 6 }}>
										<Controller
											name="name"
											control={control}
											rules={{ required: 'Character name is required' }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="Name"
													error={!!errors.name}
													helperText={errors.name?.message}
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										<Controller
											name="title"
											control={control}
											rules={{ required: 'Title is required' }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="Title"
													error={!!errors.title}
													helperText={errors.title?.message}
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										<Controller
											name="showName"
											control={control}
											rules={{ required: 'Show name is required' }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="Show/Series Name"
													error={!!errors.showName}
													helperText={errors.showName?.message}
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										<Controller
											name="gender"
											control={control}
											rules={{ required: 'Gender is required' }}
											render={({ field }) => (
												<FormControl fullWidth error={!!errors.gender}>
													<InputLabel>Gender *</InputLabel>
													<GlassSelect {...field} label="Gender *">
														{GENDER_OPTIONS.map((option) => (
															<MenuItem key={option.key} value={option.key}>
																{option.label}
															</MenuItem>
														))}
													</GlassSelect>
													{errors.gender && <FormHelperText>{errors.gender.message}</FormHelperText>}
												</FormControl>
											)}
										/>
									</Grid>
									<Grid size={12}>
										<Controller
											name="contact"
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="Contact Information"
													error={!!errors.contact}
													helperText={errors.contact?.message}
												/>
											)}
										/>
									</Grid>
								</Grid>
							</GlassCard>

							{/* Character Details */}
							<GlassCard variant="outlined">
								<Typography variant="h6" color="primary" gutterBottom>
									Character Details
								</Typography>

								<Grid container spacing={2}>
									<Grid size={12}>
										<Controller
											name="description"
											control={control}
											rules={{ required: 'Description is required' }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="Description"
													multiline
													rows={4}
													error={!!errors.description}
													helperText={errors.description?.message}
													placeholder="Describe the character's appearance, personality, background..."
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={12}>
										<Controller
											name="instruction"
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="AI Instructions"
													multiline
													rows={3}
													error={!!errors.instruction}
													helperText={
														errors.instruction?.message ||
														'Instructions for how the AI should roleplay this character'
													}
													placeholder="You are [character name]. You should speak like... Your personality is..."
												/>
											)}
										/>
									</Grid>
									<Grid size={12}>
										<Controller
											name="firstMessage"
											control={control}
											rules={{ required: 'First message is required' }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label="First Message"
													multiline
													rows={3}
													error={!!errors.firstMessage}
													helperText={
														errors.firstMessage?.message ||
														"The character's opening message when starting a new conversation"
													}
													placeholder="Hello! I'm [character name]. It's nice to meet you..."
													required
												/>
											)}
										/>
									</Grid>
								</Grid>
							</GlassCard>

							{/* Action Buttons */}
							<Box display="flex" gap={2} justifyContent="flex-end">
								<GlassButton
									colorVariant="silver"
									variant="outlined"
									onClick={() => navigate(`/${routeConstants.CHARACTER}`)}
									disabled={isSubmitting}
									type="button"
								>
									{getLangText(LANG_KEYS.CANCEL)}
								</GlassButton>
								<GlassButton
									colorVariant="primary"
									type="submit"
									disabled={isSubmitting}
									loading={isSubmitting}
								>
									{isSubmitting && getLangText(LANG_KEYS.CREATING)}
								</GlassButton>
							</Box>
						</Box>
					</Grid>
				</Grid>
			</form>
		</GlassPaper>
	);
};

export default NewCharacterPage;
