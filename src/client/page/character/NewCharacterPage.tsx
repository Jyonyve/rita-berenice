import { LANG_KEYS, LangKey } from '#shared/config/langConstants.js';
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
import { BASE_IMAGE_DIR, LIMIT_5MB, REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { SolidMetallicButton } from '../../layout/SolidMetallicButton.jsx';
import { Swiper, SwiperSlide } from 'swiper/react';
import { PortraitWithChip } from '../../layout/PortraitWithChip.jsx';
import { A11y, EffectFade, Mousewheel, Pagination } from 'swiper/modules';

// Gender options

const GENDER_OPTIONS = [
	{ key: LANG_KEYS.MALE.toLowerCase(), label: getLangText(LANG_KEYS.MALE) },
	{ key: LANG_KEYS.FEMALE.toLowerCase(), label: getLangText(LANG_KEYS.FEMALE) },
	{ key: LANG_KEYS.OTHER.toLowerCase(), label: getLangText(LANG_KEYS.OTHER) },
];

export const EMOTION_OPTIONS = Object.entries(EMOTION_CATEGORY_NAMES).map(([key, value]) => ({
	key: value,
	label: getLangText(value.toUpperCase() as LangKey),
	emotionKey: parseInt(key),
}));

interface UploadedImage {
	file: File;
	emotion: string;
	emotionKey: number;
	preview: string;
}

const NewCharacterPage: FC<{ userId: string }> = ({ userId }) => {
	const navigate = useNavigate();
	const { addToast } = useToast();
	const { storeCharacter, uploadCharacterImage, createCharacterFolder } = useCharacterApi();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
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
			userId,
			firstMessage: '',
		},
		mode: 'onBlur',
	});

	const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
	const [selectedEmotion, setSelectedEmotion] = useState<string>(DEFAULT_EMOTION);

	const getEmotionKey = (emotionName: string): number => {
		const option = EMOTION_OPTIONS.find((opt) => opt.key === emotionName);
		return option ? option.emotionKey : 0;
	};

	const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			return addToast(getLangAlertText(LANG_KEYS.INVALID_FILE_TYPE), 'error');
		}
		if (file.size > LIMIT_5MB) {
			return addToast(getLangAlertText(LANG_KEYS.FILE_TOO_LARGE), 'error');
		}

		const existingIndex = uploadedImages.findIndex((img) => img.emotion === selectedEmotion);
		const newImage: UploadedImage = {
			file,
			emotion: selectedEmotion,
			emotionKey: getEmotionKey(selectedEmotion),
			preview: URL.createObjectURL(file),
		};

		setUploadedImages((prev) => {
			const newImages = [...prev];
			if (existingIndex >= 0) {
				URL.revokeObjectURL(newImages[existingIndex].preview);
				newImages[existingIndex] = newImage;
			} else {
				newImages.push(newImage);
			}
			return newImages;
		});

		if (fileInputRef.current) fileInputRef.current.value = '';
		addToast(getLangAlertText(LANG_KEYS.IMAGE_UPLOADED_FOR), 'success');
	};

	const handleRemoveImage = (emotion: string) => {
		setUploadedImages((prev) => {
			const imageToRemove = prev.find((img) => img.emotion === emotion);
			if (imageToRemove) URL.revokeObjectURL(imageToRemove.preview);
			return prev.filter((img) => img.emotion !== emotion);
		});
	};

	const uploadPortraits = async (characterId: string, images: UploadedImage[]): Promise<void> => {
		try {
			await createCharacterFolder({ characterId });
			await Promise.all(
				images.map((image) => {
					const formData = new FormData();
					formData.append('image', image.file);
					formData.append('characterId', characterId);
					formData.append('emotion', image.emotion);
					return uploadCharacterImage(formData);
				})
			);
		} catch (error) {
			console.error('Error uploading images:', error);
			throw error;
		}
	};

	const onSubmit = async (data: CharacterCdo) => {
		try {
			const response = await storeCharacter(data);
			const { characterId } = JSON.parse(response);
			if (characterId) {
				if (uploadedImages.length > 0) {
					await uploadPortraits(characterId, uploadedImages);
				}
				addToast(getLangAlertText(LANG_KEYS.CHARACTER_CREATED_SUCCESS), 'success');
				navigate(`/${routeConstants.CHARACTER}/${characterId}`);
			} else {
				throw new Error(getLangText(LANG_KEYS.FAILED_TO_CREATE_CHARACTER));
			}
		} catch (error: any) {
			console.error('Error creating character:', error);
			addToast(error.message || getLangAlertText(LANG_KEYS.ERROR_CREATING_CHARACTER), 'error');
		}
	};

	return (
		<GlassPaper key="new-character-page" className="paper">
			<form onSubmit={handleSubmit(onSubmit)}>
				<Grid container spacing={containerSpacing}>
					{/* Left Column */}
					<Grid
						size={{ xs: 12, md: 4 }}
						sx={{ position: { md: 'sticky' }, top: (theme) => theme.spacing(2), alignSelf: 'flex-start' }}
					>
						<Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
							{/* Image Preview */}
							<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								{uploadedImages.length > 0 ? (
									// ✅ Swiper logic is now directly in this component
									<Box sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
										<Swiper
											modules={[Pagination, A11y, EffectFade, Mousewheel]}
											slidesPerView={1}
											loop={true}
											effect="fade"
											fadeEffect={{ crossFade: true }}
											style={{ overflow: 'visible' }}
											pagination={{ clickable: true }}
											mousewheel={{ forceToAxis: true, sensitivity: 1, releaseOnEdges: true, invert: true }}
										>
											{uploadedImages.map((image) => {
												const emotionLabel =
													EMOTION_OPTIONS.find((e) => e.key === image.emotion)?.label || image.emotion;
												return (
													<SwiperSlide key={image.emotion}>
														<PortraitWithChip imageUrl={image.preview} label={emotionLabel} />
													</SwiperSlide>
												);
											})}
										</Swiper>
									</Box>
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
							<GlassCard variant="outlined">
								<Typography color="secondary" variant="h6" gutterBottom>
									{getLangText(LANG_KEYS.PORTRAIT)}
								</Typography>
								<FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
									<InputLabel>{getLangText(LANG_KEYS.EMOTION)}</InputLabel>
									<GlassSelect
										value={selectedEmotion}
										onChange={(e) => setSelectedEmotion(e.target.value as string)}
									>
										{EMOTION_OPTIONS.map((opt) => (
											<MenuItem key={opt.key} value={opt.key}>
												{opt.label}
											</MenuItem>
										))}
									</GlassSelect>
								</FormControl>
								<input
									type="file"
									ref={fileInputRef}
									onChange={handleImageUpload}
									accept="image/*"
									style={{ display: 'none' }}
								/>
								<GlassButton
									fullWidth
									startIcon={<CloudUpload />}
									onClick={() => fileInputRef.current?.click()}
									colorVariant="secondary"
									sx={{ mb: 2 }}
								>
									{getLangText(LANG_KEYS.UPLOAD_IMAGE)}
								</GlassButton>
								{uploadedImages.length > 0 && (
									<Stack direction="row" flexWrap="wrap" gap={1}>
										{uploadedImages.map((img) => (
											<Chip
												key={img.emotion}
												label={EMOTION_OPTIONS.find((e) => e.key === img.emotion)?.label}
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
					{/* Right Column */}
					<Grid size={{ xs: 12, md: 8 }}>
						<Box display="flex" flexDirection="column" gap={2}>
							{/* Header */}
							<GlassCard variant="outlined">
								<RomanticTitle hover variant="h4" color="secondary" colorVariant="primary" gutterBottom>
									{watch('showName') || getLangText(LANG_KEYS.NEW_CHARACTER)}
								</RomanticTitle>
								<Typography variant="body2" color="text.secondary" mt={1} ml={2}>
									{watch('title') || getLangText(LANG_KEYS.TITLE_GUIDANCE)}
								</Typography>
							</GlassCard>
							{/* Form Sections */}
							<GlassCard variant="outlined">
								<Typography variant="h6" color="secondary" gutterBottom>
									{getLangText(LANG_KEYS.BASIC_INFO)}
								</Typography>
								<Grid container spacing={2}>
									{/* Fields: showName, name, gender, contact, title */}
									<Grid size={{ xs: 12, sm: 5 }}>
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
									<Grid size={{ xs: 12, sm: 7 }}>
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
									<Grid size={{ xs: 12, sm: 5 }}>
										<Controller
											name="gender"
											control={control}
											rules={{ required: getLangText(LANG_KEYS.GENDER_REQUIRED) }}
											render={({ field }) => (
												<FormControl fullWidth error={!!errors.gender}>
													<InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel>
													<GlassSelect {...field}>
														{GENDER_OPTIONS.map((opt) => (
															<MenuItem key={opt.key} value={opt.key}>
																{getLangText(opt.label as LangKey)}
															</MenuItem>
														))}
													</GlassSelect>
													{errors.gender && <FormHelperText>{errors.gender.message}</FormHelperText>}
												</FormControl>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 7 }}>
										<Controller
											name="contact"
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label={getLangText(LANG_KEYS.CONTACT)}
													placeholder={getLangText(LANG_KEYS.CONTACT_PLACEHOLDER)}
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12 }}>
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
							</GlassCard>
							<GlassCard variant="outlined">
								<Typography variant="h6" color="secondary" gutterBottom>
									{getLangText(LANG_KEYS.CHARACTER_DETAIL)}
								</Typography>
								<Grid container spacing={2}>
									{/* Fields: description, instruction, firstMessage */}
									<Grid size={{ xs: 12 }}>
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
													rows={3}
													error={!!errors.description}
													helperText={errors.description?.message}
													placeholder={getLangText(LANG_KEYS.DESCRIPTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12 }}>
										<Controller
											name="instruction"
											control={control}
											rules={{ required: getLangText(LANG_KEYS.INSTRUCTION_REQUIRED) }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label={getLangText(LANG_KEYS.INSTRUCTION)}
													multiline
													rows={3}
													error={!!errors.description}
													helperText={
														errors.instruction?.message || getLangText(LANG_KEYS.AI_INSTRUCTION_HELPER)
													}
													placeholder={getLangText(LANG_KEYS.INSTRUCTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>
									<Grid size={{ xs: 12 }}>
										<Controller
											name="firstMessage"
											control={control}
											rules={{ required: getLangText(LANG_KEYS.FIRST_MESSAGE_REQUIRED) }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label={getLangText(LANG_KEYS.FIRST_MESSAGE)}
													multiline
													rows={3}
													error={!!errors.firstMessage}
													helperText={
														errors.firstMessage?.message || getLangText(LANG_KEYS.FIRST_MESSAGE_HELPER)
													}
													placeholder={getLangText(LANG_KEYS.FIRST_MESSAGE_PLACEHOLDER)}
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
								>
									{getLangText(LANG_KEYS.CANCEL)}
								</GlassButton>
								<SolidMetallicButton
									colorVariant="gold"
									type="submit"
									disabled={isSubmitting}
									loading={isSubmitting}
								>
									{isSubmitting ? getLangText(LANG_KEYS.CREATING) : getLangText(LANG_KEYS.CREATE)}
								</SolidMetallicButton>
							</Box>
						</Box>
					</Grid>
				</Grid>
			</form>
		</GlassPaper>
	);
};

export default NewCharacterPage;
