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
} from '#shared/config/constants.js';

export interface CropConfig {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface ImageProcessOptions {
	outputSize?: { width: number; height: number };
	format: 'webp' | 'avif' | 'jpeg' | 'png';
	crop?: CropConfig;
	aspectRatio?: string;
}

const storage = multer.memoryStorage();

const SUPPORTED_IMAGE_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.svg',
	'.avif',
	'.webp',
	'.bmp',
	'.tiff',
	'.ico',
];

const SUPPORTED_IMAGE_MIMETYPES = [
	'image/png',
	'image/jpg',
	'image/jpeg',
	'image/gif',
	'image/svg+xml',
	'image/avif',
	'image/webp',
	'image/bmp',
	'image/tiff',
	'image/x-icon',
	'image/vnd.microsoft.icon',
];

const createImageUpload = (maxFileSize: number = LIMIT_5MB) => {
	return multer({
		storage,
		limits: { fileSize: maxFileSize },
		fileFilter: (req, file, cb) => {
			// Check both mimetype and file extension for comprehensive support
			const mimetypeValid = SUPPORTED_IMAGE_MIMETYPES.includes(file.mimetype);
			const extensionValid = file.originalname
				? SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())
				: false;

			if (mimetypeValid || extensionValid) {
				cb(null, true);
			} else {
				cb(
					new Error(
						`Only image files are allowed! Supported formats: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`
					)
				);
			}
		},
	});
};

export const imageUpload = createImageUpload();
export const avatarUpload = createImageUpload(LIMIT_5MB);
export const characterUpload = createImageUpload(LIMIT_5MB);

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
 */
const applyFormat = (processor: sharp.Sharp, format: string): sharp.Sharp => {
	switch (format) {
		case 'webp':
			return processor.webp({ lossless: true }); // Lossless for avatars
		case 'avif':
			return processor.avif({ lossless: true }); // Lossless for characters/lore
		case 'jpeg':
			return processor.jpeg({ quality: 100 }); // Maximum quality if needed
		case 'png':
			return processor.png({ compressionLevel: 0 }); // No compression
		default:
			return processor.webp({ lossless: true });
	}
};

/**
 * Calculates dimensions based on aspect ratio
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

/**
 * Processes user avatar image (fixed 512x512 square, WebP format)
 */
export const processUserAvatar = async (
	buffer: Buffer,
	userId: string,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	const config: ImageProcessOptions = {
		format: 'webp', // Always WebP for avatars
		outputSize: { width: 512, height: 512 },
		...options,
	};

	const uploadDir = `${BASE_USER_IMAGE_DIR}/${userId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `image.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	// Apply crop if provided
	if (config.crop) {
		processor = processor.extract({
			left: Math.round(config.crop.x),
			top: Math.round(config.crop.y),
			width: Math.round(config.crop.width),
			height: Math.round(config.crop.height),
		});
	} else {
		// Auto-crop to square from center
		const metadata = await sharp(buffer).metadata();
		const { width = 0, height = 0 } = metadata;
		const cropSize = Math.min(width, height);
		const left = Math.floor((width - cropSize) / 2);
		const top = Math.floor((height - cropSize) / 2);

		processor = processor.extract({ left, top, width: cropSize, height: cropSize });
	}

	// Always resize to 512x512
	processor = processor.resize(512, 512, { fit: 'cover', position: 'center' });

	// Apply format (lossless WebP)
	processor = applyFormat(processor, config.format);

	await processor.toFile(filePath);

	return `${RUNTIME_USER_IMAGE_DIR}/${userId}/${fileName}`;
};

/**
 * Processes character image (5:7 aspect ratio, AVIF format)
 */
export const processCharacterImage = async (
	buffer: Buffer,
	characterId: string,
	emotionKey: number,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	const config: ImageProcessOptions = {
		format: 'avif', // Always AVIF for characters
		...options,
	};

	const uploadDir = `${BASE_CHARACTER_IMAGE_DIR}/${characterId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `${characterId}_${emotionKey}.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	// Apply crop if provided
	if (config.crop) {
		processor = processor.extract({
			left: Math.round(config.crop.x),
			top: Math.round(config.crop.y),
			width: Math.round(config.crop.width),
			height: Math.round(config.crop.height),
		});
	}

	// Calculate dimensions for 5:7 aspect ratio
	if (config.aspectRatio) {
		const dimensions = calculateAspectRatioDimensions(config.aspectRatio, 700);
		processor = processor.resize(dimensions.width, dimensions.height, {
			fit: 'cover',
			position: 'center',
		});
	}

	// Apply format (lossless AVIF)
	processor = applyFormat(processor, config.format);

	await processor.toFile(filePath);

	return `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${fileName}`;
};

/**
 * Processes lore image (5:7 aspect ratio, AVIF format)
 */
export const processLoreImage = async (
	buffer: Buffer,
	loreId: string,
	options: Partial<ImageProcessOptions> = {}
): Promise<string> => {
	const config: ImageProcessOptions = {
		format: 'avif', // Always AVIF for lore
		aspectRatio: '5/7',
		...options,
	};

	const uploadDir = `${BASE_CHARACTER_IMAGE_DIR}/lore/${loreId}`;
	ensureDirectoryExists(uploadDir);

	const fileName = `${loreId}_lore.${config.format}`;
	const filePath = path.join(process.cwd(), uploadDir, fileName);

	let processor = sharp(buffer);

	if (config.crop) {
		processor = processor.extract({
			left: Math.round(config.crop.x),
			top: Math.round(config.crop.y),
			width: Math.round(config.crop.width),
			height: Math.round(config.crop.height),
		});
	}

	if (config.aspectRatio) {
		const dimensions = calculateAspectRatioDimensions(config.aspectRatio, 600);
		processor = processor.resize(dimensions.width, dimensions.height, {
			fit: 'cover',
			position: 'center',
		});
	}

	processor = applyFormat(processor, config.format);
	await processor.toFile(filePath);

	return `${RUNTIME_CHARACTER_IMAGE_DIR}/lore/${loreId}/${fileName}`;
};

/**
 * Deletes user avatar files
 */
export const deleteUserAvatar = async (userId: string): Promise<void> => {
	const formats = ['webp', 'jpg', 'jpeg', 'png'];

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
 * Deletes character image files
 */
export const deleteCharacterImage = async (
	characterId: string,
	emotionKey: number
): Promise<void> => {
	const formats = ['avif', 'webp', 'jpg', 'jpeg', 'png'];

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
 */
export const deleteLoreImage = async (loreId: string): Promise<void> => {
	const formats = ['webp', 'jpg', 'jpeg', 'png'];

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
