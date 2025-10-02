// server/util/imageProcessor.ts
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
	LIMIT_5MB,
	BASE_CHARACTER_IMAGE_DIR,
	BASE_USER_IMAGE_DIR,
	RUNTIME_CHARACTER_IMAGE_DIR,
	RUNTIME_USER_IMAGE_DIR,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_IMAGE_MIMETYPES,
	IMAGE_PROCESSING_CONFIG,
	ASPECT_RATIO_STRINGS,
	getDeletionFormats,
	getUnsupportedImageError,
	ImageFormat,
} from '@rita-berenice/shared/config';

// ==================== Types ====================
export interface CropConfig {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ImageProcessOptions {
	outputSize?: { width: number; height: number };
	format: ImageFormat;
	crop?: CropConfig;
	aspectRatio?: string;
}

// ==================== Multer Setup ====================
const storage = multer.memoryStorage();

const createImageUpload = (maxFileSize: number = LIMIT_5MB) => {
	return multer({
		storage,
		limits: { fileSize: maxFileSize },
		fileFilter: (req, file, cb) => {
			const mimetypeValid = SUPPORTED_IMAGE_MIMETYPES.includes(file.mimetype);
			const extensionValid = file.originalname
				? SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())
				: false;

			if (mimetypeValid || extensionValid) {
				cb(null, true);
			} else {
				cb(new Error(getUnsupportedImageError()));
			}
		},
	});
};

export const imageUpload = createImageUpload();
export const avatarUpload = createImageUpload(LIMIT_5MB);
export const characterUpload = createImageUpload(LIMIT_5MB);

// ==================== Helper Functions ====================
/**
 * Creates directory if it doesn't exist
 */
export const ensureDirectoryExists = (directoryPath: string): void => {
	const fullPath = path.join(process.cwd(), directoryPath);
	if (!fs.existsSync(fullPath)) {
		fs.mkdirSync(fullPath, { recursive: true });
		console.log(`Created directory: ${fullPath}`);
	}
};

/**
 * Applies format-specific processing without quality reduction
 * All formats use lossless/maximum quality settings
 */
const applyFormat = (processor: sharp.Sharp, format: ImageFormat): sharp.Sharp => {
	switch (format) {
		case 'webp':
			return processor.webp({ lossless: true });
		case 'avif':
			return processor.avif({ lossless: true });
		case 'jpeg':
			return processor.jpeg({ quality: 100 });
		case 'png':
			return processor.png({ compressionLevel: 0 });
		default:
			return processor.webp({ lossless: true });
	}
};

/**
 * Calculates dimensions based on aspect ratio string (e.g., "5/7")
 */
const calculateAspectRatioDimensions = (
	aspectRatio: string,
	baseSize: number
): { width: number; height: number } => {
	const [widthRatio, heightRatio] = aspectRatio.split('/').map((num) => parseFloat(num.trim()));

	if (widthRatio >= heightRatio) {
		const width = baseSize;
		const height = Math.round(baseSize * (heightRatio / widthRatio));
		return { width, height };
	} else {
		const height = baseSize;
		const width = Math.round(baseSize * (widthRatio / heightRatio));
		return { width, height };
	}
};

// ==================== Image Processing Functions ====================
/**
 * Processes user avatar image
 * - Client sends already cropped WebP from canvas
 * - Server resizes to 512x512 and converts to lossless WebP
 */
export const processUserAvatar = async (
	buffer: Buffer,
	userId: string,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	// Use shared config
	const config: ImageProcessOptions = {
		format: IMAGE_PROCESSING_CONFIG.USER_AVATAR.format,
		outputSize: IMAGE_PROCESSING_CONFIG.USER_AVATAR.dimensions,
		...options,
	};

	const uploadDir = `${BASE_USER_IMAGE_DIR}/${userId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `image.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	// Client already cropped the image, just resize to final dimensions
	processor = processor.resize(config.outputSize!.width, config.outputSize!.height, {
		fit: 'cover',
		position: 'center',
	});

	// Apply lossless WebP format
	processor = applyFormat(processor, config.format);

	await processor.toFile(filePath);

	return `${RUNTIME_USER_IMAGE_DIR}/${userId}/${fileName}`;
};

/**
 * Processes character portrait image
 * - Client sends already cropped WebP from canvas
 * - Server converts to lossless AVIF with 5:7 aspect ratio
 */
export const processCharacterImage = async (
	buffer: Buffer,
	characterId: string,
	emotionKey: number,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	// Use shared config
	const config: ImageProcessOptions = {
		format: IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.format,
		aspectRatio: ASPECT_RATIO_STRINGS.CHARACTER,
		...options,
	};

	const uploadDir = `${BASE_CHARACTER_IMAGE_DIR}/${characterId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `${characterId}_${emotionKey}.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	// Calculate dimensions for aspect ratio if specified
	if (config.aspectRatio) {
		const dimensions = calculateAspectRatioDimensions(
			config.aspectRatio,
			IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.baseSize
		);
		processor = processor.resize(dimensions.width, dimensions.height, {
			fit: 'cover',
			position: 'center',
		});
	}

	// Apply lossless AVIF format
	processor = applyFormat(processor, config.format);

	await processor.toFile(filePath);

	return `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${fileName}`;
};

/**
 * Processes lore image
 * - Client sends already cropped WebP from canvas
 * - Server converts to lossless AVIF with 5:7 aspect ratio
 */
export const processLoreImage = async (
	buffer: Buffer,
	loreId: string,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	// Use shared config
	const config: ImageProcessOptions = {
		format: IMAGE_PROCESSING_CONFIG.LORE_IMAGE.format,
		aspectRatio: ASPECT_RATIO_STRINGS.LORE,
		...options,
	};

	const uploadDir = `${BASE_CHARACTER_IMAGE_DIR}/lore/${loreId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `${loreId}_lore.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	if (config.aspectRatio) {
		const dimensions = calculateAspectRatioDimensions(
			config.aspectRatio,
			IMAGE_PROCESSING_CONFIG.LORE_IMAGE.baseSize
		);
		processor = processor.resize(dimensions.width, dimensions.height, {
			fit: 'cover',
			position: 'center',
		});
	}

	processor = applyFormat(processor, config.format);
	await processor.toFile(filePath);

	return `${RUNTIME_CHARACTER_IMAGE_DIR}/lore/${loreId}/${fileName}`;
};

// ==================== Deletion Functions ====================
/**
 * Deletes user avatar files
 * Checks current format first, then legacy formats for backward compatibility
 */
export const deleteUserAvatar = async (userId: string): Promise<void> => {
	const currentFormat = IMAGE_PROCESSING_CONFIG.USER_AVATAR.format;
	const formats = getDeletionFormats(currentFormat);

	for (const format of formats) {
		const filePath = path.join(process.cwd(), `${BASE_USER_IMAGE_DIR}/${userId}/image.${format}`);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Deleted avatar: ${filePath}`);
			break;
		}
	}
};

/**
 * Deletes character portrait files
 * Checks current format first, then legacy formats for backward compatibility
 */
export const deleteCharacterImage = async (
	characterId: string,
	emotionKey: number
): Promise<void> => {
	const currentFormat = IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.format;
	const formats = getDeletionFormats(currentFormat);

	for (const format of formats) {
		const filePath = path.join(
			process.cwd(),
			`${BASE_CHARACTER_IMAGE_DIR}/${characterId}/${characterId}_${emotionKey}.${format}`
		);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Deleted character image: ${filePath}`);
			break;
		}
	}
};

/**
 * Deletes lore image files
 * Checks current format first, then legacy formats for backward compatibility
 */
export const deleteLoreImage = async (loreId: string): Promise<void> => {
	const currentFormat = IMAGE_PROCESSING_CONFIG.LORE_IMAGE.format;
	const formats = getDeletionFormats(currentFormat);

	for (const format of formats) {
		const filePath = path.join(
			process.cwd(),
			`${BASE_CHARACTER_IMAGE_DIR}/lore/${loreId}/${loreId}_lore.${format}`
		);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Deleted lore image: ${filePath}`);
			break;
		}
	}
};
