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
import {
	EMOTION_SELECT_MENUITEM,
	GENDER_SELECT_MENUITEM,
	getLangAlertText,
	getLangText,
	emotionToLangKey,
} from '../../util/translateUtils.js';
import { DEFAULT_EMOTION, EmotionValue } from '#shared/config/emotionConstants.js';
import { LIMIT_5MB, REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { SolidMetallicButton } from '../../layout/SolidMetallicButton.jsx';
import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';
import { PortraitWithChip } from '../../layout/PortraitWithChip.jsx';
import { A11y, EffectFade, Mousewheel, Pagination } from 'swiper/modules';
import { getImageForEmotion } from '../../util/portraitUtils.js';

// Shared image type
interface UploadedImage {
	file?: File; // present only for newly added/replaced files
	emotion: string; // emotion key string
	emotionKey: number; // numeric key used by server
	preview: string; // object URL or existing URL
	toDelete?: boolean; // mark deletion in edit mode
}

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
			gender: '',
			name: '',
			showName: '',
			userId,
			firstMessage: '',
			...(mode === 'edit' && characterInfo ? characterInfo : {}),
		},
		mode: 'onBlur',
	});

	// Hydrate when character changes in edit mode
	useEffect(() => {
		if (mode === 'edit' && characterInfo) {
			reset({ ...characterInfo });
		}
	}, [mode, characterInfo, reset]);

	// Images state
	const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
	const [selectedEmotion, setSelectedEmotion] = useState<EmotionValue>(DEFAULT_EMOTION);

	const getEmotionKey = (emotionName: string): number => {
		const option = EMOTION_SELECT_MENUITEM.find((opt) => opt.key === emotionName);
		return option ? option.emotionKey : 0;
	};

	// Initialize images for edit mode
	useEffect(() => {
		if (mode === 'edit' && characterInfo?.characterId) {
			const entries: UploadedImage[] = EMOTION_SELECT_MENUITEM.map((opt) => {
				const url = getImageForEmotion(characterInfo.characterId, opt.key);
				return url
					? { file: undefined, emotion: opt.key, emotionKey: opt.emotionKey, preview: url }
					: null;
			}).filter(Boolean) as UploadedImage[];
			setUploadedImages(entries);
		}
	}, [mode, characterInfo]);

	// Auto-slide to newest image
	useEffect(() => {
		if (swiperRef.current && uploadedImages.length > 0) {
			swiperRef.current.slideTo(uploadedImages.length - 1);
		}
	}, [uploadedImages]);

	// FIXED: Correctly extract the first file from FileList
	const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]; // Fixed: was missing [0]
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			return addToast(getLangAlertText(LANG_KEYS.INVALID_FILE_TYPE), 'error');
		}
		if (file.size > LIMIT_5MB) {
			return addToast(getLangAlertText(LANG_KEYS.FILE_TOO_LARGE), 'error');
		}

		const idx = uploadedImages.findIndex((img) => img.emotion === selectedEmotion);
		const newImage: UploadedImage = {
			file,
			emotion: selectedEmotion,
			emotionKey: getEmotionKey(selectedEmotion),
			preview: URL.createObjectURL(file),
			toDelete: false,
		};

		setUploadedImages((prev) => {
			const next = [...prev];
			if (idx >= 0) {
				if (next[idx].preview.startsWith('blob:')) URL.revokeObjectURL(next[idx].preview);
				next[idx] = newImage;
			} else {
				next.push(newImage);
			}
			return next;
		});

		if (fileInputRef.current) fileInputRef.current.value = '';
		addToast(
			`${getLangText(emotionToLangKey(selectedEmotion))} ${getLangAlertText(LANG_KEYS.IMAGE_UPLOADED_FOR)}`,
			'success',
			1500
		);
	};

	// Handle image removal with different behavior for create vs edit
	const handleRemoveImage = (emotion: string) => {
		setUploadedImages((prev) => {
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

	const uploadPortraits = async (characterId: string, images: UploadedImage[]): Promise<void> => {
		await createCharacterFolder({ characterId });
		await Promise.all(
			images
				.filter((img) => img.file && !img.toDelete)
				.map((image) => {
					const formData = new FormData();
					formData.append('image', image.file!);
					formData.append('characterId', characterId);
					formData.append('emotionKey', image.emotionKey.toString());
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
			await uploadPortraits(characterId, replacements);
		}
	};

	const onSubmit = async (data: CharacterCdo | CharacterInfo) => {
		try {
			// Normalize payload based on mode
			const payload: CharacterCdo | CharacterInfo =
				mode === 'edit' && characterInfo
					? {
							...(data as CharacterInfo),
							characterId: characterInfo.characterId,
							createdAt: characterInfo.createdAt,
							userId,
						}
					: { ...(data as CharacterCdo), userId };

			const response = await storeCharacter(payload);
			const { characterId } = JSON.parse(response);

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
								{uploadedImages.filter((img) => !img?.toDelete).length > 0 ? (
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
											{uploadedImages
												.filter((img) => !img?.toDelete)
												.map((image) => {
													const emotionLabel =
														EMOTION_SELECT_MENUITEM.find((e) => e.key === image.emotion)?.label || image.emotion;
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
										onChange={(e) => setSelectedEmotion(e.target.value as EmotionValue)}
									>
										{EMOTION_SELECT_MENUITEM.map((opt) => (
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
								{uploadedImages.filter((img) => !img?.toDelete).length > 0 && (
									<Stack direction="row" flexWrap="wrap" gap={1}>
										{uploadedImages
											.filter((img) => !img?.toDelete)
											.map((img) => (
												<Chip
													key={img.emotion}
													label={EMOTION_SELECT_MENUITEM.find((e) => e.key === img.emotion)?.label}
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
									{mode === 'edit'
										? watch('showName') || getLangText(LANG_KEYS.EDIT_CHARACTER)
										: watch('showName') || getLangText(LANG_KEYS.NEW_CHARACTER)}
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
									{/* showName */}
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
									{/* Other form fields... */}
								</Grid>
							</GlassCard>

							<GlassCard variant="outlined">
								<Typography variant="h6" color="secondary" gutterBottom>
									{getLangText(LANG_KEYS.CHARACTER_DETAIL)}
								</Typography>
								<Grid container spacing={2}>
									{/* description, instruction, firstMessage fields */}
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
									{isSubmitting
										? mode === 'edit'
											? getLangText(LANG_KEYS.UPDATING)
											: getLangText(LANG_KEYS.CREATING)
										: mode === 'edit'
											? getLangText(LANG_KEYS.UPDATE)
											: getLangText(LANG_KEYS.CREATE)}
								</SolidMetallicButton>
							</Box>
						</Box>
					</Grid>
				</Grid>
			</form>
		</GlassPaper>
	);
};
