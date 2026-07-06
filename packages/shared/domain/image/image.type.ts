// shared/domain/image.type.ts

/**
 * Base uploaded image structure
 * Used for user avatars and general image uploads
 */
export interface UploadedImage {
	file?: File;
	preview: string;
	crop?: CropData | null; // Add if needed
}

/**
 * Character portrait image with emotion metadata
 * Extends UploadedImage with character-specific fields
 */
export interface UploadedCharacterImage extends UploadedImage {
	emotion: string;
	emotionKey: number;
	toDelete?: boolean;
}

/**
 * Crop area coordinates from react-easy-crop
 * Used for server-side crop processing (legacy)
 */
export interface CropData {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Result of client-side image processing
 * Returned by crop utilities
 */
export interface CroppedImageResult {
	file: File;
	previewUrl: string;
}

/**
 * Image processing options for server-side Sharp
 */
export interface ImageProcessOptions {
	outputSize?: { width: number; height: number };
	format: string; // Use string instead of ImageFormat to avoid circular dependency
	crop?: CropData;
	aspectRatio?: string;
}
