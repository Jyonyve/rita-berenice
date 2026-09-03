// server/util/imageProcessor.ts
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import {
  LIMIT_5MB,
  RUNTIME_CHARACTER_IMAGE_DIR,
  RUNTIME_PROFILE_IMAGE_DIR,
  RUNTIME_USER_IMAGE_DIR,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_IMAGE_MIMETYPES,
  IMAGE_PROCESSING_CONFIG,
  ASPECT_RATIO_STRINGS,
  getDeletionFormats,
  getUnsupportedImageError,
  ImageFormat,
} from '@rita-berenice/shared/config';
import { flowLogger } from './jsonlLogger.js';
import {
  appendImageAssetVersion,
  deleteImageAsset,
  getImageAsset,
  getCharacterImageStorageDir,
  getLoreImageStorageDir,
  getProfileImageStorageDir,
  getUserImageStorageDir,
  isObjectImageStorageConfigured,
  putImageAsset,
} from './imageStorageUtils.js';

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
export const profileUpload = createImageUpload(LIMIT_5MB);

// ==================== Helper Functions ====================
/**
 * Creates directory if it doesn't exist
 */
export const ensureDirectoryExists = (directoryPath: string): void => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    flowLogger.info('imageProcessingUtils', 'directory.created', { directoryPath });
  }
};

/**
 * Applies lossless/maximum-quality format settings.
 * New runtime images use lossless WebP because it encodes much faster than lossless AVIF.
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
const calculateAspectRatioDimensions = (aspectRatio: string, baseSize: number): { width: number; height: number } => {
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
  options: Partial<ImageProcessOptions> = {},
): Promise<string> => {
  // Use shared config
  const config: ImageProcessOptions = {
    format: IMAGE_PROCESSING_CONFIG.USER_AVATAR.format,
    outputSize: IMAGE_PROCESSING_CONFIG.USER_AVATAR.dimensions,
    ...options,
  };

  const fileName = `image.${config.format}`;
  const runtimePath = `${RUNTIME_USER_IMAGE_DIR}/${userId}/${fileName}`;

  let processor = sharp(buffer);

  // Client already cropped the image, just resize to final dimensions
  processor = processor.resize(config.outputSize!.width, config.outputSize!.height, {
    fit: 'cover',
    position: 'center',
  });

  // Apply lossless WebP format
  processor = applyFormat(processor, config.format);

  const version = await putImageAsset(runtimePath, await processor.toBuffer());
  return appendImageAssetVersion(runtimePath, version);
};

/**
 * Processes character portrait image
 * - Client sends already cropped WebP from canvas
 * - Server converts to lossless WebP with 5:7 aspect ratio
 */
export const processCharacterImage = async (
  buffer: Buffer,
  characterId: string,
  emotionKey: number,
  options: Partial<ImageProcessOptions> = {},
): Promise<string> => {
  // Use shared config
  const config: ImageProcessOptions = {
    format: IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.format,
    aspectRatio: ASPECT_RATIO_STRINGS.CHARACTER,
    ...options,
  };

  const uploadDir = getCharacterImageStorageDir(characterId);
  ensureDirectoryExists(uploadDir);

  const fileName = `${characterId}_${emotionKey}.${config.format}`;
  const filePath = path.join(uploadDir, fileName);

  let processor = sharp(buffer);

  // Calculate dimensions for aspect ratio if specified
  if (config.aspectRatio) {
    const dimensions = IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.dimensions;
    processor = processor.resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'center',
    });
  }

  // Apply the configured lossless runtime format
  processor = applyFormat(processor, config.format);

  if (isObjectImageStorageConfigured()) {
    await putImageAsset(`${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${fileName}`, await processor.toBuffer());
  } else {
    await processor.toFile(filePath);
  }

  return `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${fileName}`;
};

/** Processes and replaces a full portrait and its required square avatar as one asset pair. */
export const processCharacterImagePair = async (
  portraitBuffer: Buffer,
  avatarBuffer: Buffer,
  characterId: string,
  emotionKey: number,
): Promise<{ portraitPath: string; avatarPath: string }> => {
  const portraitConfig = IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT;
  const avatarConfig = IMAGE_PROCESSING_CONFIG.CHARACTER_AVATAR;
  const uploadDir = getCharacterImageStorageDir(characterId);
  ensureDirectoryExists(uploadDir);

  const portraitFileName = `${characterId}_${emotionKey}.${portraitConfig.format}`;
  const avatarFileName = `${characterId}_${emotionKey}_a.${avatarConfig.format}`;
  const portraitFilePath = path.join(uploadDir, portraitFileName);
  const avatarFilePath = path.join(uploadDir, avatarFileName);
  const portraitRuntimePath = `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${portraitFileName}`;
  const avatarRuntimePath = `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${avatarFileName}`;
  const portraitDimensions = portraitConfig.dimensions;

  const [portraitOutput, avatarOutput] = await Promise.all([
    applyFormat(
      sharp(portraitBuffer).resize(portraitDimensions.width, portraitDimensions.height, {
        fit: 'cover',
        position: 'center',
      }),
      portraitConfig.format,
    ).toBuffer(),
    applyFormat(
      sharp(avatarBuffer).resize(avatarConfig.dimensions.width, avatarConfig.dimensions.height, {
        fit: 'cover',
        position: 'center',
      }),
      avatarConfig.format,
    ).toBuffer(),
  ]);

  if (isObjectImageStorageConfigured()) {
    const previousAssets = await Promise.all([getImageAsset(portraitRuntimePath), getImageAsset(avatarRuntimePath)]);

    const writeResults = await Promise.allSettled([
      putImageAsset(portraitRuntimePath, portraitOutput),
      putImageAsset(avatarRuntimePath, avatarOutput),
    ]);
    const failedWrite = writeResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failedWrite) {
      for (const [index, runtimePath] of [portraitRuntimePath, avatarRuntimePath].entries()) {
        const previousAsset = previousAssets[index];
        if (previousAsset) {
          await putImageAsset(runtimePath, previousAsset.body, previousAsset.contentType);
        } else {
          await deleteImageAsset(runtimePath);
        }
      }
      throw failedWrite.reason;
    }

    return { portraitPath: portraitRuntimePath, avatarPath: avatarRuntimePath };
  }

  const token = randomUUID();
  const targets = [portraitFilePath, avatarFilePath];
  const temporaryPaths = targets.map((target) => `${target}.${token}.tmp`);
  const backupPaths = targets.map((target) => `${target}.${token}.bak`);
  const hadExistingTarget = targets.map((target) => fs.existsSync(target));
  const backedUpTargets = targets.map(() => false);
  const committedTargets = targets.map(() => false);

  await Promise.all([
    fs.promises.writeFile(temporaryPaths[0], portraitOutput),
    fs.promises.writeFile(temporaryPaths[1], avatarOutput),
  ]);

  try {
    for (let index = 0; index < targets.length; index += 1) {
      if (hadExistingTarget[index]) {
        fs.renameSync(targets[index], backupPaths[index]);
        backedUpTargets[index] = true;
      }
    }
    for (let index = 0; index < targets.length; index += 1) {
      fs.renameSync(temporaryPaths[index], targets[index]);
      committedTargets[index] = true;
    }
  } catch (error) {
    for (let index = 0; index < targets.length; index += 1) {
      if (committedTargets[index] && fs.existsSync(targets[index])) fs.unlinkSync(targets[index]);
    }
    for (let index = 0; index < targets.length; index += 1) {
      if (backedUpTargets[index] && fs.existsSync(backupPaths[index])) {
        fs.renameSync(backupPaths[index], targets[index]);
      }
    }
    throw error;
  } finally {
    for (const temporaryPath of temporaryPaths) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    for (const backupPath of backupPaths) {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    }
  }

  return {
    portraitPath: `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${portraitFileName}`,
    avatarPath: `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${avatarFileName}`,
  };
};

/** Processes and replaces a session profile portrait and avatar as one asset pair. */
export const processProfileImagePair = async (
  portraitBuffer: Buffer,
  avatarBuffer: Buffer,
  profileId: string,
): Promise<{ portraitPath: string; avatarPath: string }> => {
  const portraitConfig = IMAGE_PROCESSING_CONFIG.PROFILE_PORTRAIT;
  const avatarConfig = IMAGE_PROCESSING_CONFIG.PROFILE_AVATAR;
  const uploadDir = getProfileImageStorageDir(profileId);
  ensureDirectoryExists(uploadDir);

  // Match character asset naming. The current single pair is Neutral (emotion key 0).
  const portraitFileName = `${profileId}_0.${portraitConfig.format}`;
  const avatarFileName = `${profileId}_0_a.${avatarConfig.format}`;
  const portraitFilePath = path.join(uploadDir, portraitFileName);
  const avatarFilePath = path.join(uploadDir, avatarFileName);
  const portraitRuntimePath = `${RUNTIME_PROFILE_IMAGE_DIR}/${profileId}/${portraitFileName}`;
  const avatarRuntimePath = `${RUNTIME_PROFILE_IMAGE_DIR}/${profileId}/${avatarFileName}`;

  const [portraitOutput, avatarOutput] = await Promise.all([
    applyFormat(
      sharp(portraitBuffer).resize(portraitConfig.dimensions.width, portraitConfig.dimensions.height, {
        fit: 'cover',
        position: 'center',
      }),
      portraitConfig.format,
    ).toBuffer(),
    applyFormat(
      sharp(avatarBuffer).resize(avatarConfig.dimensions.width, avatarConfig.dimensions.height, {
        fit: 'cover',
        position: 'center',
      }),
      avatarConfig.format,
    ).toBuffer(),
  ]);

  if (isObjectImageStorageConfigured()) {
    const previousAssets = await Promise.all([getImageAsset(portraitRuntimePath), getImageAsset(avatarRuntimePath)]);
    const writeResults = await Promise.allSettled([
      putImageAsset(portraitRuntimePath, portraitOutput),
      putImageAsset(avatarRuntimePath, avatarOutput),
    ]);
    const failedWrite = writeResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failedWrite) {
      for (const [index, runtimePath] of [portraitRuntimePath, avatarRuntimePath].entries()) {
        const previousAsset = previousAssets[index];
        if (previousAsset) {
          await putImageAsset(runtimePath, previousAsset.body, previousAsset.contentType);
        } else {
          await deleteImageAsset(runtimePath);
        }
      }
      throw failedWrite.reason;
    }

    return { portraitPath: portraitRuntimePath, avatarPath: avatarRuntimePath };
  }

  const token = randomUUID();
  const targets = [portraitFilePath, avatarFilePath];
  const temporaryPaths = targets.map((target) => `${target}.${token}.tmp`);
  const backupPaths = targets.map((target) => `${target}.${token}.bak`);
  const hadExistingTarget = targets.map((target) => fs.existsSync(target));
  const backedUpTargets = targets.map(() => false);
  const committedTargets = targets.map(() => false);

  await Promise.all([
    fs.promises.writeFile(temporaryPaths[0], portraitOutput),
    fs.promises.writeFile(temporaryPaths[1], avatarOutput),
  ]);

  try {
    for (let index = 0; index < targets.length; index += 1) {
      if (hadExistingTarget[index]) {
        fs.renameSync(targets[index], backupPaths[index]);
        backedUpTargets[index] = true;
      }
    }
    for (let index = 0; index < targets.length; index += 1) {
      fs.renameSync(temporaryPaths[index], targets[index]);
      committedTargets[index] = true;
    }
  } catch (error) {
    for (let index = 0; index < targets.length; index += 1) {
      if (committedTargets[index] && fs.existsSync(targets[index])) fs.unlinkSync(targets[index]);
    }
    for (let index = 0; index < targets.length; index += 1) {
      if (backedUpTargets[index] && fs.existsSync(backupPaths[index])) {
        fs.renameSync(backupPaths[index], targets[index]);
      }
    }
    throw error;
  } finally {
    for (const temporaryPath of temporaryPaths) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    for (const backupPath of backupPaths) {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    }
  }

  return { portraitPath: portraitRuntimePath, avatarPath: avatarRuntimePath };
};

/**
 * Processes lore image
 * - Client sends already cropped WebP from canvas
 * - Server converts to lossless WebP with 5:7 aspect ratio
 */
export const processLoreImage = async (
  buffer: Buffer,
  loreId: string,
  options: Partial<ImageProcessOptions> = {},
): Promise<string> => {
  // Use shared config
  const config: ImageProcessOptions = {
    format: IMAGE_PROCESSING_CONFIG.LORE_IMAGE.format,
    aspectRatio: ASPECT_RATIO_STRINGS.LORE,
    ...options,
  };

  const uploadDir = getLoreImageStorageDir(loreId);
  ensureDirectoryExists(uploadDir);

  const fileName = `${loreId}_lore.${config.format}`;
  const filePath = path.join(uploadDir, fileName);

  let processor = sharp(buffer);

  if (config.aspectRatio) {
    const dimensions = calculateAspectRatioDimensions(config.aspectRatio, IMAGE_PROCESSING_CONFIG.LORE_IMAGE.baseSize);
    processor = processor.resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'center',
    });
  }

  processor = applyFormat(processor, config.format);
  if (isObjectImageStorageConfigured()) {
    await putImageAsset(`${RUNTIME_CHARACTER_IMAGE_DIR}/lore/${loreId}/${fileName}`, await processor.toBuffer());
  } else {
    await processor.toFile(filePath);
  }

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
    await deleteImageAsset(`${RUNTIME_USER_IMAGE_DIR}/${userId}/image.${format}`);
  }
  flowLogger.info('imageProcessingUtils', 'avatar.deleted', { userId });
};

/**
 * Deletes character portrait files
 * Checks current format first, then legacy formats for backward compatibility
 */
export const deleteCharacterImage = async (characterId: string, emotionKey: number): Promise<void> => {
  const currentFormat = IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.format;
  const formats = getDeletionFormats(currentFormat);

  for (const suffix of ['', '_a']) {
    for (const format of formats) {
      await deleteImageAsset(
        `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/${characterId}_${emotionKey}${suffix}.${format}`,
      );
    }
  }
  flowLogger.info('imageProcessingUtils', 'characterImage.deleted', { characterId, emotionKey });
};

/**
 * Deletes lore image files
 * Checks current format first, then legacy formats for backward compatibility
 */
export const deleteLoreImage = async (loreId: string): Promise<void> => {
  const currentFormat = IMAGE_PROCESSING_CONFIG.LORE_IMAGE.format;
  const formats = getDeletionFormats(currentFormat);

  for (const format of formats) {
    await deleteImageAsset(`${RUNTIME_CHARACTER_IMAGE_DIR}/lore/${loreId}/${loreId}_lore.${format}`);
  }
  flowLogger.info('imageProcessingUtils', 'loreImage.deleted', { loreId });
};
