import { LANG_KEYS, LangKey } from '#shared/config/langConstants.js';
import { CharacterCdo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
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
import { FC, useState, useRef, ChangeEvent, useEffect } from 'react';

import { useForm, Controller } from 'react-hook-form';
import { CloudUpload } from '@mui/icons-material';
import { useCharacterApi, useLoreApi } from '../../hook/api/index.js';
import { GlassButton, GlassCard, GlassPaper, GlassSelect } from '../../layout/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { containerSpacing } from '../../style/index.js';
import {
	getEmotionSelectLabel,
	getLangAlertText,
	getLangText,
	emotionToLangKey,
	getGenderSelectLabel,
} from '../../util/translateUtils.js';
import { DEFAULT_EMOTION, EmotionValue } from '#shared/config/emotionConstants.js';
import { ASPECT_RATIOS, LIMIT_5MB, REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';
import { A11y, EffectFade, Mousewheel, Pagination } from 'swiper/modules';
import { getImageForEmotion } from '../../util/portraitUtils.js';
import {
	ImageCropModal,
	RomanticTitle,
	SolidMetallicButton,
	PortraitWithChip,
} from '../../layout/index.js';
import { UploadedCharacterImage } from '#shared/domain/image/ImageInterfaces.js';
import { createBasicCharacterInfo, isCharacterInfo } from '#shared/util/typeGuardUtils.js';

// 🎨 Constants
const AUTO_SLIDE_DELAY = 100;
const TOAST_DURATION = 1500;
const EMPTY_IMAGE_HEIGHT = 300;

// 🎨 Helper Functions
const getVisibleImages = (images: UploadedCharacterImage[]) =>
	images.filter((img) => !img?.toDelete);

const getEmotionLabel = (emotionKey: string) =>
	getEmotionSelectLabel().find((e) => e.key === emotionKey)?.label || emotionKey;

type Props = {
	mode: 'create' | 'edit';
	userId: string;
	characterInfo?: CharacterInfo;
	onCancel: () => void;
	onSuccess: (characterId: string) => void;
};

export const CharacterForm: FC<Props> = ({ mode, userId, characterInfo, onCancel, onSuccess }) => {
	const { addToast } = useToast();
	const { storeCharacter, uploadCharacterImage, createCharacterFolder, deleteCharacterImage } =
		useCharacterApi();
	const { storeLore } = useLoreApi();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const swiperRef = useRef<SwiperClass | null>(null);

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
		watch,
		reset,
	} = useForm<CharacterCdo | CharacterInfo>({
		defaultValues: {
			title: '',
			contact: '',
			description: '',
			instruction: '',
			gender: 'other',
			name: '',
			showName: '',
			userId,
			worldLoreId: '', // Now required in CDO
			firstMessage: '', // Now included in CDO
			...(mode === 'edit' && characterInfo ? characterInfo : {}),
		},
		mode: 'onBlur',
	});

	// State
	const [uploadedImages, setUploadedCharacterImages] = useState<UploadedCharacterImage[]>([]);
	const [selectedEmotion, setSelectedEmotion] = useState<EmotionValue>(DEFAULT_EMOTION);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
	const [modalImageUrl, setModalImageUrl] = useState<string>('');
	const [lastUploadedEmotion, setLastUploadedEmotion] = useState<string | null>(null);

	// 🎨 Helper Functions
	const getEmotionKey = (emotionName: string): number => {
		const option = getEmotionSelectLabel().find((opt) => opt.key === emotionName);
		return option ? option.emotionKey : 0;
	};

	// Effects
	useEffect(() => {
		if (mode === 'edit' && characterInfo) {
			reset({ ...characterInfo });
		}
	}, [mode, characterInfo, reset]);

	useEffect(() => {
		if (mode === 'edit' && characterInfo?.characterId) {
			const entries: UploadedCharacterImage[] = getEmotionSelectLabel()
				.map((opt) => {
					const url = getImageForEmotion(characterInfo.characterId, opt.key);
					return url
						? { file: undefined, emotion: opt.key, emotionKey: opt.emotionKey, preview: url }
						: null;
				})
				.filter(Boolean) as UploadedCharacterImage[];
			setUploadedCharacterImages(entries);
		}
	}, [mode, characterInfo]);

	useEffect(() => {
		if (swiperRef.current && uploadedImages.length > 0) {
			swiperRef.current.slideTo(uploadedImages.length - 1);
		}
	}, [uploadedImages]);

	// 🎨 Improved auto-slide effect
	useEffect(() => {
		if (!lastUploadedEmotion || !swiperRef.current) return;

		const visibleImages = getVisibleImages(uploadedImages);
		const targetIndex = visibleImages.findIndex((img) => img.emotion === lastUploadedEmotion);

		if (targetIndex >= 0) {
			setTimeout(() => {
				swiperRef.current?.slideTo(targetIndex);
			}, AUTO_SLIDE_DELAY);
		}

		setLastUploadedEmotion(null);
	}, [uploadedImages, lastUploadedEmotion]);

	useEffect(() => {
		return () => {
			// Clean up any data URLs and blob URLs when component unmounts
			uploadedImages.forEach((img) => {
				if (img.preview.startsWith('blob:')) {
					URL.revokeObjectURL(img.preview);
				}
			});

			// Clean up modal image URL
			if (modalImageUrl && modalImageUrl.startsWith('blob:')) {
				URL.revokeObjectURL(modalImageUrl);
			}
		};
	}, []);

	// 🎨 Cleaner image upload handler
	const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Early returns for validation
		if (!file.type.startsWith('image/')) {
			return addToast(getLangAlertText(LANG_KEYS.INVALID_FILE_TYPE), 'error');
		}
		if (file.size > LIMIT_5MB) {
			return addToast(getLangAlertText(LANG_KEYS.FILE_TOO_LARGE), 'error');
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			if (!result) return;

			setModalImageUrl(result);
			setPendingImageFile(file);
			setCropModalOpen(true);
		};
		reader.onerror = () => addToast('Error reading image file', 'error');
		reader.readAsDataURL(file);

		// Clear input
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	const handleRemoveImage = (emotion: string) => {
		setUploadedCharacterImages((prev) => {
			const idx = prev.findIndex((img) => img.emotion === emotion);
			if (idx < 0) return prev;
			const next = [...prev];
			const item = next[idx];

			if (mode === 'create') {
				if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
				return next.filter((img) => img.emotion !== emotion);
			} else {
				// edit: mark delete unless this is a new file in this session
				if (item.file) {
					if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
					return next.filter((img) => img.emotion !== emotion);
				}
				next[idx] = { ...item, toDelete: true };
				return next;
			}
		});
	};

	// 🎨 Enhanced crop complete handler with better error handling
	const handleCropComplete = (croppedAreaPixels: any) => {
		if (!pendingImageFile || !modalImageUrl) {
			console.warn('Missing required data for crop completion');
			return;
		}

		try {
			const idx = uploadedImages.findIndex((img) => img.emotion === selectedEmotion);
			const newImage: UploadedCharacterImage = {
				file: pendingImageFile,
				emotion: selectedEmotion,
				emotionKey: getEmotionKey(selectedEmotion),
				preview: modalImageUrl,
				toDelete: false,
				crop: croppedAreaPixels,
			};

			setUploadedCharacterImages((prev) => {
				const next = [...prev];
				if (idx >= 0) {
					if (next[idx].preview.startsWith('blob:')) {
						URL.revokeObjectURL(next[idx].preview);
					}
					next[idx] = newImage;
				} else {
					next.push(newImage);
				}
				return next;
			});

			setLastUploadedEmotion(selectedEmotion);
			addToast(
				`${getLangText(emotionToLangKey(selectedEmotion))} ${getLangAlertText(LANG_KEYS.IMAGE_UPLOADED_FOR)}`,
				'success',
				TOAST_DURATION
			);
		} catch (error) {
			console.error('Error in crop completion:', error);
			addToast('Failed to process image', 'error');
		} finally {
			setPendingImageFile(null);
			setModalImageUrl('');
			setCropModalOpen(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const handleModalClose = () => {
		setCropModalOpen(false);
		setPendingImageFile(null);
		setModalImageUrl('');
	};

	const uploadPortraits = async (
		characterId: string,
		images: UploadedCharacterImage[]
	): Promise<void> => {
		await createCharacterFolder({ characterId });
		await Promise.all(
			images
				.filter((img) => img.file && !img.toDelete)
				.map((image) => {
					const formData = new FormData();
					formData.append('image', image.file!);
					formData.append('characterId', characterId);
					formData.append('emotionKey', image.emotionKey.toString());

					if (image.crop) {
						formData.append('crop', JSON.stringify(image.crop));
					}

					return uploadCharacterImage(formData);
				})
		);
	};

	const applyPortraitDiffs = async (characterId: string): Promise<void> => {
		// Deletes
		const deletions = uploadedImages.filter((img) => img.toDelete);
		await Promise.all(
			deletions.map((img) => deleteCharacterImage({ characterId, emotionKey: img.emotionKey }))
		);

		// Replacements / additions
		const replacements = uploadedImages.filter((img) => img.file && !img.toDelete);
		if (replacements.length > 0) {
			await Promise.all(
				replacements.map((image) => {
					const formData = new FormData();
					formData.append('image', image.file!);
					formData.append('characterId', characterId);
					formData.append('emotionKey', image.emotionKey.toString());

					if (image.crop) {
						formData.append('crop', JSON.stringify(image.crop));
					}

					return uploadCharacterImage(formData);
				})
			);
		}
	};

	const onSubmit = async (data: CharacterCdo | CharacterInfo) => {
		try {
			let payload: CharacterInfo;

			if (mode === 'edit' && isCharacterInfo(data)) {
				payload = { ...data };
			} else {
				payload = createBasicCharacterInfo(data);
			}

			const response = await storeCharacter(payload);
			const { characterId } = response;

			if (mode === 'create') {
				await uploadPortraits(characterId, uploadedImages);
			} else {
				await applyPortraitDiffs(characterId);
			}
			onSuccess(characterId);
		} catch (error: any) {
			addToast(error.message || 'An error occurred while saving the character.', 'error');
		}
	};
	// 🎨 Helper variables for cleaner JSX
	const visibleImages = getVisibleImages(uploadedImages);
	const hasImages = visibleImages.length > 0;
	const formTitle =
		mode === 'edit'
			? watch('showName') || getLangText(LANG_KEYS.EDIT_CHARACTER)
			: watch('showName') || getLangText(LANG_KEYS.NEW_CHARACTER);
	const formSubtitle = watch('title') || getLangText(LANG_KEYS.TITLE_GUIDANCE);
	const submitButtonText = isSubmitting
		? mode === 'edit'
			? getLangText(LANG_KEYS.UPDATING)
			: getLangText(LANG_KEYS.CREATING)
		: mode === 'edit'
			? getLangText(LANG_KEYS.UPDATE)
			: getLangText(LANG_KEYS.CREATE);

	return (
		<GlassPaper key="character-form" className="paper">
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
								{hasImages ? (
									<Box sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
										<Swiper
											onSwiper={(swiper) => {
												swiperRef.current = swiper;
											}}
											modules={[Pagination, A11y, EffectFade, Mousewheel]}
											slidesPerView={1}
											loop={false}
											effect="fade"
											fadeEffect={{ crossFade: true }}
											style={{ overflow: 'visible' }}
											pagination={{ clickable: true }}
											mousewheel={{ forceToAxis: true, sensitivity: 1, releaseOnEdges: true, invert: true }}
										>
											{visibleImages.map((image) => (
												<SwiperSlide key={image.emotion}>
													<PortraitWithChip imageUrl={image.preview} label={getEmotionLabel(image.emotion)} />
												</SwiperSlide>
											))}
										</Swiper>
									</Box>
								) : (
									<Box
										width="100%"
										height={EMPTY_IMAGE_HEIGHT}
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
										onChange={(e) => setSelectedEmotion(e.target.value as EmotionValue)}
									>
										{getEmotionSelectLabel().map((opt) => (
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
									{getLangText(LANG_KEYS.SELECT_IMAGE)}
								</GlassButton>
								{hasImages && (
									<Stack direction="row" flexWrap="wrap" gap={1}>
										{visibleImages.map((img) => (
											<Chip
												key={img.emotion}
												label={getEmotionLabel(img.emotion)}
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
									{formTitle}
								</RomanticTitle>
								<Typography variant="body2" color="text.secondary" mt={1} ml={2}>
									{formSubtitle}
								</Typography>
							</GlassCard>

							{/* Basic Info Section */}
							<GlassCard variant="outlined">
								<Typography variant="h6" color="secondary" gutterBottom>
									{getLangText(LANG_KEYS.BASIC_INFO)}
								</Typography>
								<Grid container spacing={2}>
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
												<FormControl fullWidth required error={!!errors.gender}>
													<InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel>
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

							{/* Character Detail Section */}
							<GlassCard variant="outlined">
								<Typography variant="h6" color="secondary" gutterBottom>
									{getLangText(LANG_KEYS.CHARACTER_DETAIL)}
								</Typography>
								<Grid container spacing={2}>
									{/* Instruction field */}
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
													minRows={3}
													maxRows={10}
													error={!!errors.instruction}
													helperText={errors.instruction?.message || getLangText(LANG_KEYS.INSTRUCTION_HELPER)}
													placeholder={getLangText(LANG_KEYS.INSTRUCTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>

									{/* World Lore field */}
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
													minRows={3}
													maxRows={10}
													error={!!errors.instruction}
													helperText={errors.instruction?.message || getLangText(LANG_KEYS.INSTRUCTION_HELPER)}
													placeholder={getLangText(LANG_KEYS.INSTRUCTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>

									{/* First Message field */}
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
													minRows={2}
													maxRows={6}
													error={!!errors.firstMessage}
													helperText={
														errors.firstMessage?.message || getLangText(LANG_KEYS.FIRST_MESSAGE_HELPER)
													}
													placeholder={getLangText(LANG_KEYS.FIRST_MESSAGE_PLACEHOLDER)}
													required
													slotProps={{ htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT } }}
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
									onClick={onCancel}
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
									{submitButtonText}
								</SolidMetallicButton>
							</Box>
						</Box>
					</Grid>
				</Grid>

				{/* Crop Modal */}
				{pendingImageFile && modalImageUrl && (
					<ImageCropModal
						imageSrc={modalImageUrl}
						open={cropModalOpen}
						onClose={handleModalClose}
						onCropComplete={handleCropComplete}
						aspect={ASPECT_RATIOS.CHARACTER}
					/>
				)}
			</form>
		</GlassPaper>
	);
};
