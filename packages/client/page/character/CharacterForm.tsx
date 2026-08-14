import {
	Box,
	Grid,
	Typography,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	FormHelperText,
	Chip,
	Stack,
	Avatar,
} from '@mui/material';
import { FC, useState, useRef, ChangeEvent, useEffect } from 'react';

import { useForm, Controller } from 'react-hook-form';
import CloudUpload from '@mui/icons-material/CloudUpload';
import { useCharacterApi, useLoreApi } from '../../hook/api/index.js';
import {
	GlassButton,
	GlassCard,
	GlassPaper,
	GlassSelect,
} from '../../layout/component/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { containerSpacing } from '../../style/index.js';
import {
	getEmotionSelectLabel,
	getLangAlertText,
	getLangText,
	emotionToLangKey,
	getGenderSelectLabel,
} from '../../util/translateUtils.js';
import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';
import { A11y, EffectFade, Mousewheel, Pagination } from 'swiper/modules';
import { getImageForEmotion } from '../../util/portraitUtils.js';
import {
	ImageCropModal,
	RomanticTitle,
	SolidMetallicButton,
	PortraitWithChip,
} from '../../layout/component/index.js';
import {
	EmotionKey,
	EmotionValue,
	DEFAULT_EMOTION,
	LANG_KEYS,
	LIMIT_5MB,
	REQUEST_CHARACTER_LIMIT,
	SUPPORTED_IMAGE_MIMETYPES,
	getImageInputAccept,
	PortraitUrlMap,
} from '@rita-berenice/shared/config';
import { UploadedCharacterImage, CharacterInfo, CharacterCdo } from '@rita-berenice/shared/domain';
import { isCharacterInfo, createBasicCharacterInfo } from '@rita-berenice/shared/util';
import { cleanupBlobUrl, processCroppedImage } from '../../util/cropImageUtils.js';
import { runRetriableQueue } from '../../util/retriableQueue.js';
import {
	getCharacterCropAspect,
	getCharacterCropOutputSize,
	type CharacterCropStage,
} from './characterImageCrop.js';

// 🎨 Constants
const AUTO_SLIDE_DELAY = 100;
const TOAST_DURATION = 1500;
const EMPTY_IMAGE_HEIGHT = 300;
const IMAGE_UPLOAD_CONCURRENCY = 2;
const IMAGE_UPLOAD_MAX_ATTEMPTS = 3;
const IMAGE_UPLOAD_RETRY_DELAY_MS = 750;

// 🎨 Helper Functions
const getVisibleImages = (images: UploadedCharacterImage[]) =>
	images.filter((img) => !img?.toDelete);

const getEmotionLabel = (emotionKey: string) =>
	getEmotionSelectLabel().find((e) => e.key === emotionKey)?.label || emotionKey;

type Props = {
	mode: 'create' | 'edit';
	userId: string;
	characterInfo?: CharacterInfo;
	portraitUrls?: PortraitUrlMap;
	avatarUrls?: PortraitUrlMap;
	onCancel: () => void;
	onSuccess: (characterId: string) => void;
};

export const CharacterForm: FC<Props> = ({
	mode,
	userId,
	characterInfo,
	portraitUrls,
	avatarUrls,
	onCancel,
	onSuccess,
}) => {
	const { addToast } = useToast();
	const {
		storeCharacter,
		uploadCharacterImage,
		createCharacterFolder,
		deleteCharacterImage,
		refreshCharacterImages,
	} = useCharacterApi();
	const { storeLore } = useLoreApi();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const swiperRef = useRef<SwiperClass | null>(null);
	const pendingCreateIdentityRef = useRef<
		Pick<CharacterInfo, 'characterId' | 'variant' | 'createdAt'> | undefined
	>(undefined);

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
			worldIntroduction: '',
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
	const [cropStage, setCropStage] = useState<CharacterCropStage>('portrait');
	const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
	const [pendingPortraitCrop, setPendingPortraitCrop] = useState<{
		file: File;
		previewUrl: string;
	} | null>(null);
	const [modalImageUrl, setModalImageUrl] = useState<string>('');
	const [lastUploadedEmotion, setLastUploadedEmotion] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(
		null
	);

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
					const url = getImageForEmotion(portraitUrls, opt.key);
					return url
						? {
								file: undefined,
								emotion: opt.key,
								emotionKey: opt.emotionKey,
								preview: url,
								avatarPreview: avatarUrls?.[opt.emotionKey as EmotionKey],
							}
						: null;
				})
				.filter(Boolean) as UploadedCharacterImage[];
			setUploadedCharacterImages(entries);
		}
	}, [mode, characterInfo, portraitUrls, avatarUrls]);

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
				cleanupBlobUrl(img.avatarPreview);
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

		// Use shared validation
		if (!SUPPORTED_IMAGE_MIMETYPES.includes(file.type as any)) {
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
			setCropStage('portrait');
			setCropModalOpen(true);
		};
		reader.onerror = () => addToast('Error reading image file', 'error');
		reader.readAsDataURL(file);

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
				cleanupBlobUrl(item.avatarPreview);
				return next.filter((img) => img.emotion !== emotion);
			} else {
				// edit: mark delete unless this is a new file in this session
				if (item.file) {
					if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
					cleanupBlobUrl(item.avatarPreview);
					return next.filter((img) => img.emotion !== emotion);
				}
				next[idx] = { ...item, toDelete: true };
				return next;
			}
		});
	};

	// 🎨 Enhanced crop complete handler with better error handling
	const handleCropComplete = async (croppedBlob: Blob) => {
		if (!pendingImageFile) return;

		try {
			const croppedImage = processCroppedImage(croppedBlob, pendingImageFile.name);
			if (cropStage === 'portrait') {
				cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
				setPendingPortraitCrop(croppedImage);
				setModalImageUrl(croppedImage.previewUrl);
				setCropStage('avatar');
				return;
			}

			if (!pendingPortraitCrop) throw new Error('Portrait crop is required before avatar crop.');

			const idx = uploadedImages.findIndex((img) => img.emotion === selectedEmotion);
			const newImage: UploadedCharacterImage = {
				file: pendingPortraitCrop.file,
				avatarFile: croppedImage.file,
				emotion: selectedEmotion,
				emotionKey: getEmotionKey(selectedEmotion),
				preview: pendingPortraitCrop.previewUrl,
				avatarPreview: croppedImage.previewUrl,
				toDelete: false,
			};

			setUploadedCharacterImages((prev) => {
				const next = [...prev];
				if (idx >= 0) {
					cleanupBlobUrl(next[idx].preview); // Use utility
					cleanupBlobUrl(next[idx].avatarPreview);
					next[idx] = newImage;
				} else {
					next.push(newImage);
				}
				return next;
			});

			setLastUploadedEmotion(selectedEmotion);

			if (mode === 'edit' && characterInfo?.characterId) {
				const result = await runRetriableQueue(
					[newImage],
					async (image) => uploadImagePair(characterInfo.characterId, image),
					{
						concurrency: 1,
						maxAttempts: IMAGE_UPLOAD_MAX_ATTEMPTS,
						retryDelayMs: IMAGE_UPLOAD_RETRY_DELAY_MS,
					}
				);

				if (result.failed.length > 0) {
					const failure = result.failed[0].error;
					const detail = failure instanceof Error ? ` ${failure.message}` : '';
					addToast(`Image could not be saved after retries.${detail}`, 'error');
				} else {
					setUploadedCharacterImages((previous) =>
						previous.map((image) =>
							image.emotionKey === newImage.emotionKey
								? { ...image, file: undefined, avatarFile: undefined }
								: image
						)
					);
					await refreshCharacterImages(characterInfo.characterId);
					addToast(`${getEmotionLabel(selectedEmotion)} image saved.`, 'success', TOAST_DURATION);
				}
			} else {
				addToast(
					`${getLangText(emotionToLangKey(selectedEmotion))} ${getLangAlertText(LANG_KEYS.IMAGE_UPLOADED_FOR)}`,
					'success',
					TOAST_DURATION
				);
			}
		} catch (error) {
			console.error('Error in crop completion:', error);
			addToast('Failed to process image', 'error');
		} finally {
			if (cropStage === 'avatar') {
				setPendingImageFile(null);
				setPendingPortraitCrop(null);
				setModalImageUrl('');
				setCropModalOpen(false);
				setCropStage('portrait');
				if (fileInputRef.current) fileInputRef.current.value = '';
			}
		}
	};

	const handleModalClose = () => {
		cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
		setCropModalOpen(false);
		setPendingImageFile(null);
		setPendingPortraitCrop(null);
		setModalImageUrl('');
		setCropStage('portrait');
	};

	const uploadImagePair = async (
		characterId: string,
		image: UploadedCharacterImage
	): Promise<void> => {
		const formData = new FormData();
		formData.append('image', image.file!);
		formData.append('avatar', image.avatarFile!);
		formData.append('characterId', characterId);
		formData.append('emotionKey', image.emotionKey.toString());
		await uploadCharacterImage(formData);
	};

	const uploadImagePairs = async (
		characterId: string,
		images: UploadedCharacterImage[]
	): Promise<number> => {
		const candidates = images.filter((img) => img.file && img.avatarFile && !img.toDelete);
		if (candidates.length === 0) return 0;

		setUploadProgress({ completed: 0, total: candidates.length });
		const result = await runRetriableQueue(
			candidates,
			async (image) => {
				await uploadImagePair(characterId, image);
			},
			{
				concurrency: IMAGE_UPLOAD_CONCURRENCY,
				maxAttempts: IMAGE_UPLOAD_MAX_ATTEMPTS,
				retryDelayMs: IMAGE_UPLOAD_RETRY_DELAY_MS,
				onProgress: (completed, total) => setUploadProgress({ completed, total }),
			}
		);
		setUploadProgress(null);

		if (result.failed.length > 0) {
			const succeededEmotionKeys = new Set(result.succeeded.map((image) => image.emotionKey));
			setUploadedCharacterImages((previous) =>
				previous.map((image) =>
					succeededEmotionKeys.has(image.emotionKey)
						? { ...image, file: undefined, avatarFile: undefined }
						: image
				)
			);
			throw new Error(
				`${result.failed.length} of ${candidates.length} image pairs could not be saved after retries. Save again to resume the remaining images.`
			);
		}

		return candidates.length;
	};

	const uploadPortraits = async (
		characterId: string,
		images: UploadedCharacterImage[]
	): Promise<void> => {
		await createCharacterFolder({ characterId });
		await uploadImagePairs(characterId, images);
		await refreshCharacterImages(characterId);
	};

	const applyPortraitDiffs = async (characterId: string): Promise<void> => {
		const deletions = uploadedImages.filter((img) => img.toDelete);
		for (const image of deletions) {
			await deleteCharacterImage({ characterId, emotionKey: image.emotionKey });
		}

		const uploadedCount = await uploadImagePairs(characterId, uploadedImages);

		if (deletions.length > 0 || uploadedCount > 0) {
			await refreshCharacterImages(characterId);
		}
	};

	const onSubmit = async (data: CharacterCdo | CharacterInfo) => {
		try {
			let payload: CharacterInfo;

			if (mode === 'edit' && isCharacterInfo(data)) {
				payload = { ...data };
			} else {
				payload = createBasicCharacterInfo(data);
				if (pendingCreateIdentityRef.current) {
					payload = { ...payload, ...pendingCreateIdentityRef.current };
				} else {
					pendingCreateIdentityRef.current = {
						characterId: payload.characterId,
						variant: payload.variant,
						createdAt: payload.createdAt,
					};
				}
			}

			const response = await storeCharacter(payload);
			const { characterId } = response;

			if (mode === 'create') {
				await uploadPortraits(characterId, uploadedImages);
			} else {
				await applyPortraitDiffs(characterId);
			}
			pendingCreateIdentityRef.current = undefined;
			onSuccess(characterId);
		} catch (error: any) {
			setUploadProgress(null);
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
	const baseSubmitButtonText = isSubmitting
		? mode === 'edit'
			? getLangText(LANG_KEYS.UPDATING)
			: getLangText(LANG_KEYS.CREATING)
		: mode === 'edit'
			? getLangText(LANG_KEYS.UPDATE)
			: getLangText(LANG_KEYS.CREATE);
	const submitButtonText = uploadProgress
		? `${baseSubmitButtonText} (${uploadProgress.completed}/${uploadProgress.total})`
		: baseSubmitButtonText;

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
													<Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
														<PortraitWithChip
															imageUrl={image.preview}
															label={getEmotionLabel(image.emotion)}
															bottomRightOverlay={
																image.avatarPreview ? (
																	<Avatar
																		src={image.avatarPreview}
																		alt={`${getEmotionLabel(image.emotion)} avatar`}
																		sx={{
																			position: 'absolute',
																			right: 8,
																			bottom: 8,
																			width: 64,
																			height: 64,
																			border: 2,
																			borderColor: 'background.paper',
																		}}
																	/>
																) : (
																	<Chip
																		label={getLangText(LANG_KEYS.AVATAR_MISSING)}
																		color="warning"
																		size="small"
																		sx={{ position: 'absolute', right: 8, bottom: 8 }}
																	/>
																)
															}
														/>
													</Box>
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
									accept={getImageInputAccept()}
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
									<Grid size={{ xs: 12 }}>
										<Controller
											name="worldIntroduction"
											control={control}
											rules={{ required: getLangText(LANG_KEYS.WORLD_INTRODUCTION_REQUIRED) }}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label={getLangText(LANG_KEYS.WORLD_INTRODUCTION)}
													multiline
													minRows={3}
													maxRows={10}
													error={!!errors.worldIntroduction}
													helperText={
														errors.worldIntroduction?.message || getLangText(LANG_KEYS.WORLD_INTRODUCTION_HELPER)
													}
													placeholder={getLangText(LANG_KEYS.WORLD_INTRODUCTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>

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
													minRows={3}
													maxRows={10}
													error={!!errors.description}
													helperText={errors.description?.message || getLangText(LANG_KEYS.DESCRIPTION_HELPER)}
													placeholder={getLangText(LANG_KEYS.DESCRIPTION_PLACEHOLDER)}
													required
												/>
											)}
										/>
									</Grid>

									{/* Instruction field */}
									<Grid size={{ xs: 12 }}>
										<Controller
											name="instruction"
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													fullWidth
													label={getLangText(LANG_KEYS.INSTRUCTION)}
													multiline
													minRows={3}
													maxRows={10}
													helperText={getLangText(LANG_KEYS.INSTRUCTION_HELPER)}
													placeholder={getLangText(LANG_KEYS.INSTRUCTION_PLACEHOLDER)}
												/>
											)}
										/>
									</Grid>

									{/* World Lore field */}
									{/* <Grid size={{ xs: 12 }}>
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
									</Grid> */}

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
						aspect={getCharacterCropAspect(cropStage)}
						outputSize={getCharacterCropOutputSize(cropStage)}
						title={cropStage === 'portrait' ? 'Crop full portrait' : 'Crop emotion avatar'}
					/>
				)}
			</form>
		</GlassPaper>
	);
};
