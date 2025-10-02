// shared/config/imageConstants.ts

// ==================== File Paths ====================
export const RUNTIME_CHARACTER_IMAGE_DIR = '/assets/character' as const;
export const RUNTIME_USER_IMAGE_DIR = '/assets/user' as const;
export const DEFAULT_USER_AVATAR = '/assets/user/new_user.webp' as const;
export const DEFAULT_CHARACTER_AVATAR = '/assets/character/new_character.webp' as const;
export const BASE_CHARACTER_IMAGE_DIR = `public${RUNTIME_CHARACTER_IMAGE_DIR}` as const;
export const SOURCE_CHARACTER_IMAGE_DIR = `/${BASE_CHARACTER_IMAGE_DIR}` as const;
export const BASE_USER_IMAGE_DIR = `public${RUNTIME_USER_IMAGE_DIR}` as const;
export const SOURCE_USER_IMAGE_DIR = `/${BASE_USER_IMAGE_DIR}` as const;

// ==================== Aspect Ratios ====================
/**
 * Aspect ratios for different image types
 * Use numeric values for easier calculations
 */
export const ASPECT_RATIOS = {
	CHARACTER: 5 / 7, // Portrait (0.714...)
	LORE: 5 / 7, // Same as character (0.714...)
	USER: 1, // Square (1:1)
} as const;

/**
 * Aspect ratio strings for server-side Sharp processing
 */
export const ASPECT_RATIO_STRINGS = { CHARACTER: '5/7', LORE: '5/7', USER: '1/1' } as const;

// ==================== Base Image Formats ====================
/**
 * Base image format strings (no dots, no 'image/' prefix)
 * Single source of truth for all format-related constants
 * - SVG excluded: security risk (can contain scripts)
 * - BMP/TIFF/ICO excluded: uncommon for web, bloated file sizes
 */
const BASE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'] as const;

type BaseFormat = (typeof BASE_FORMATS)[number];

/**
 * Supported image file extensions (with dots)
 */
export const SUPPORTED_IMAGE_EXTENSIONS = BASE_FORMATS.map((f) => `.${f}`) as readonly string[];

/**
 * Supported MIME types for image uploads
 * Note: Skips 'image/jpg' as it's non-standard (browsers use 'image/jpeg')
 */
export const SUPPORTED_IMAGE_MIMETYPES = BASE_FORMATS.filter((f) => f !== 'jpg').map(
	(f) => `image/${f}`
) as readonly string[];

// ==================== Image Formats ====================
/**
 * Image format types for processing
 */
export const IMAGE_FORMATS = { WEBP: 'webp', AVIF: 'avif', JPEG: 'jpeg', PNG: 'png' } as const;

/**
 * Type representing valid image formats
 */
export type ImageFormat = (typeof IMAGE_FORMATS)[keyof typeof IMAGE_FORMATS];

// ==================== Processing Configuration ====================
/**
 * Image processing configurations by type
 */
export const IMAGE_PROCESSING_CONFIG = {
	USER_AVATAR: {
		format: IMAGE_FORMATS.WEBP as ImageFormat,
		dimensions: { width: 512, height: 512 },
		aspectRatio: ASPECT_RATIO_STRINGS.USER,
	},
	CHARACTER_PORTRAIT: {
		format: IMAGE_FORMATS.AVIF as ImageFormat,
		aspectRatio: ASPECT_RATIO_STRINGS.CHARACTER,
		baseSize: 700,
	},
	LORE_IMAGE: {
		format: IMAGE_FORMATS.AVIF as ImageFormat,
		aspectRatio: ASPECT_RATIO_STRINGS.LORE,
		baseSize: 600,
	},
} as const;

// ==================== Canvas Configuration ====================
/**
 * Canvas output configuration for client-side cropping
 * - Format: Always WebP (best browser support for encoding)
 * - Quality: 1.0 (100%) for maximum quality preservation
 *
 * Note: Quality range is 0.0-1.0 for canvas.toBlob()
 * - 1.0 (100%): Maximum quality, no compression artifacts
 *
 * The WebP file will then be converted to AVIF (lossless) on the server,
 * preserving the maximum quality from the client-side crop.
 */
export const CANVAS_OUTPUT_CONFIG = {
	format: IMAGE_FORMATS.WEBP as ImageFormat,
	quality: 1.0, // 100% - maximum quality, no quality loss
} as const;

// ==================== Helper Functions ====================
/**
 * Gets deletion check formats in priority order
 * Current format first, then other supported formats (excluding GIF)
 */
export const getDeletionFormats = (currentFormat: ImageFormat): string[] => {
	const allFormats = BASE_FORMATS.filter((f) => f !== 'gif'); // Exclude GIF from server-side
	// Move current format to front, convert to array
	return [currentFormat, ...allFormats.filter((f) => f !== currentFormat)];
};

// ==================== Validation Helpers ====================
/**
 * Validates if a file extension is supported
 * @param filename - The filename to check
 * @returns True if the extension is valid
 */
export const isValidImageExtension = (filename: string): boolean => {
	if (!filename || typeof filename !== 'string') return false;
	const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
	return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
};

/**
 * Validates if a MIME type is supported
 * @param mimeType - The MIME type to check
 * @returns True if the MIME type is valid
 */
export const isValidImageMimeType = (mimeType: string): boolean => {
	if (!mimeType || typeof mimeType !== 'string') return false;
	return SUPPORTED_IMAGE_MIMETYPES.includes(mimeType);
};

/**
 * Gets the accept attribute value for HTML file inputs
 * @returns Comma-separated list of accepted MIME types
 * @example <input type="file" accept={getImageInputAccept()} />
 */
export const getImageInputAccept = (): string => {
	return SUPPORTED_IMAGE_MIMETYPES.join(',');
};

/**
 * Gets a user-friendly error message for unsupported file types
 * @returns Error message string with supported formats
 */
export const getUnsupportedImageError = (): string => {
	return `Only image files are allowed. Supported formats: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`;
};
