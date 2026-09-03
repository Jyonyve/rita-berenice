// client/util/cropImageUtils.ts
import { CANVAS_OUTPUT_CONFIG } from '@rita-berenice/shared/config';

/**
 * Creates an Image element from a URL
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Crops an image using canvas and returns a Blob
 * Uses shared config for a bounded, lossless PNG intermediate
 *
 * @param imageSrc - Source image URL (data: or blob:)
 * @param pixelCrop - Crop area coordinates from react-easy-crop
 * @returns Promise<Blob> - Cropped image as a lossless PNG blob
 */
export const getCroppedImageBlob = async (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  outputSize: { width: number; height: number },
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  // Encode only the pixels retained by the server. Keeping full-resolution phone
  // crops here can make lossless WebP inputs larger than the upload limit even
  // though Sharp immediately resizes them to these final dimensions.
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the cropped portion of the image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize.width,
    outputSize.height,
  );

  // Convert to blob using shared CANVAS_OUTPUT_CONFIG
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas encoding failed'));
        }
      },
      `image/${CANVAS_OUTPUT_CONFIG.format}`, // 'image/png'
      CANVAS_OUTPUT_CONFIG.quality, // 1.0
    );
  });
};

/**
 * Creates a File from a Blob with proper naming
 *
 * @param blob - Image blob (WebP format)
 * @param originalFileName - Original file name
 * @returns File object with .webp extension
 */
export const blobToCanvasImageFile = (blob: Blob, originalFileName: string): File => {
  const nameWithoutExt = originalFileName.replace(/\.[^.]+$/, '');
  return new File([blob], `${nameWithoutExt}.${CANVAS_OUTPUT_CONFIG.format}`, {
    type: `image/${CANVAS_OUTPUT_CONFIG.format}`,
  });
};

/**
 * Result of processing a cropped image
 */
export interface CroppedImageResult {
  file: File;
  previewUrl: string;
}

/**
 * Processes a cropped blob into a File with preview URL
 * Handles the complete crop-to-upload workflow
 *
 * @param croppedBlob - The cropped image blob from canvas
 * @param originalFileName - Original filename for naming
 * @returns Object with File and preview URL
 * @throws Error if blob processing fails
 *
 * @example
 * const result = processCroppedImage(blob, 'avatar.jpg');
 * // result.file -> File('avatar.png', ...)
 * // result.previewUrl -> 'blob:http://...'
 * // Remember to revoke: URL.revokeObjectURL(result.previewUrl)
 */
export const processCroppedImage = (croppedBlob: Blob, originalFileName: string): CroppedImageResult => {
  if (!croppedBlob || !(croppedBlob instanceof Blob)) {
    throw new Error('Invalid blob provided');
  }

  // Preserve the configured intermediate format in the multipart filename and MIME type.
  const file = blobToCanvasImageFile(croppedBlob, originalFileName);

  // Create preview URL
  const previewUrl = URL.createObjectURL(croppedBlob);

  return { file, previewUrl };
};

/**
 * Cleanup utility for blob URLs
 * Safely revokes a blob URL if it's valid
 *
 * @param url - The blob URL to revoke
 */
export const cleanupBlobUrl = (url?: string | null): void => {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Failed to revoke blob URL:', error);
    }
  }
};
