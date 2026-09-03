import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  IMAGE_PROCESSING_CONFIG,
  EmotionKey,
  PortraitUrlMap,
  RUNTIME_CHARACTER_IMAGE_DIR,
  RUNTIME_PROFILE_IMAGE_DIR,
  RUNTIME_USER_IMAGE_DIR,
  SUPPORTED_IMAGE_EXTENSIONS,
  validEmotionKeys,
} from '@rita-berenice/shared/config';
import { getImageStorageEnv, getServerEnv } from '../config/env.js';

const ASSET_URL_PREFIX = '/assets';
const REPOSITORY_ROOT =
  process.env.NODE_ENV === 'production' ? process.cwd() : fileURLToPath(new URL('../../../', import.meta.url));

const stripAssetPrefix = (runtimePath: string) => runtimePath.replace(`${ASSET_URL_PREFIX}/`, '');

const normalizeAssetVersion = (etag?: string, lastModified?: Date) =>
  etag?.replaceAll('"', '') || (lastModified ? String(lastModified.getTime()) : '');

export const appendImageAssetVersion = (runtimePath: string, version?: string): string =>
  version ? `${runtimePath}?v=${encodeURIComponent(version)}` : runtimePath;

const getObjectStorageConfig = () => {
  const config = getImageStorageEnv();
  if (!config.BUCKET_NAME) return undefined;

  return {
    bucketName: config.BUCKET_NAME,
    endpoint: config.AWS_ENDPOINT_URL_S3!,
    accessKeyId: config.AWS_ACCESS_KEY_ID!,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
    region: config.AWS_REGION,
  };
};

let objectStorageClient: S3Client | undefined;
const getObjectStorageClient = (): S3Client => {
  const config = getObjectStorageConfig();
  if (!config) throw new Error('Object image storage is not configured');

  objectStorageClient ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return objectStorageClient;
};

const normalizeAssetKey = (runtimePath: string): string => {
  const normalizedPath = runtimePath.replaceAll('\\', '/');
  if (!normalizedPath.startsWith(`${ASSET_URL_PREFIX}/`)) {
    throw new Error(`Image asset path must start with ${ASSET_URL_PREFIX}/`);
  }

  const key = normalizedPath.slice(`${ASSET_URL_PREFIX}/`.length);
  if (!key || key.startsWith('/') || key.split('/').some((segment) => segment === '..')) {
    throw new Error('Invalid image asset path');
  }
  return key;
};

const getLocalImageAssetPath = (runtimePath: string): string => {
  const storageRoot = getLocalImageStorageRoot();
  const filePath = path.resolve(storageRoot, normalizeAssetKey(runtimePath));
  const relativePath = path.relative(storageRoot, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Image asset path escapes the configured storage root');
  }
  return filePath;
};

const isMissingObjectError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'NoSuchKey' ||
    error.name === 'NotFound' ||
    ('$metadata' in error && (error.$metadata as { httpStatusCode?: number } | undefined)?.httpStatusCode === 404));

const inferImageContentType = (runtimePath: string): string => {
  switch (path.extname(runtimePath).toLowerCase()) {
    case '.avif':
      return 'image/avif';
    case '.jpeg':
    case '.jpg':
    case '.jfif':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

export interface ImageAsset {
  body: Buffer;
  contentType: string;
  etag?: string;
}

export const isObjectImageStorageConfigured = (): boolean => Boolean(getObjectStorageConfig());

export const getLocalImageStorageRoot = (): string => {
  const { LOCAL_IMAGE_STORAGE_DIR } = getServerEnv();
  return path.resolve(REPOSITORY_ROOT, LOCAL_IMAGE_STORAGE_DIR);
};

export const ensureLocalImageStorageRoot = (): string => {
  const storageRoot = getLocalImageStorageRoot();
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }
  return storageRoot;
};

export const ensureImageStorageDirectory = (runtimeDirectory: string): void => {
  if (isObjectImageStorageConfigured()) return;
  const directoryPath = getLocalImageAssetPath(`${runtimeDirectory}/.directory`);
  fs.mkdirSync(path.dirname(directoryPath), { recursive: true });
};

export const putImageAsset = async (
  runtimePath: string,
  body: Buffer,
  contentType = inferImageContentType(runtimePath),
): Promise<string> => {
  const config = getObjectStorageConfig();
  if (!config) {
    const filePath = getLocalImageAssetPath(runtimePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, body);
    return String((await fs.promises.stat(filePath)).mtimeMs);
  }

  const response = await getObjectStorageClient().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: normalizeAssetKey(runtimePath),
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, no-cache',
    }),
  );
  return normalizeAssetVersion(response.ETag);
};

export const getImageAsset = async (runtimePath: string): Promise<ImageAsset | undefined> => {
  const config = getObjectStorageConfig();
  if (!config) {
    try {
      const body = await fs.promises.readFile(getLocalImageAssetPath(runtimePath));
      return { body, contentType: inferImageContentType(runtimePath) };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  try {
    const response = await getObjectStorageClient().send(
      new GetObjectCommand({ Bucket: config.bucketName, Key: normalizeAssetKey(runtimePath) }),
    );
    if (!response.Body) return undefined;

    return {
      body: Buffer.from(await response.Body.transformToByteArray()),
      contentType: response.ContentType ?? inferImageContentType(runtimePath),
      etag: response.ETag,
    };
  } catch (error) {
    if (isMissingObjectError(error)) return undefined;
    throw error;
  }
};

export const deleteImageAsset = async (runtimePath: string): Promise<void> => {
  const config = getObjectStorageConfig();
  if (!config) {
    await fs.promises.rm(getLocalImageAssetPath(runtimePath), { force: true });
    return;
  }

  await getObjectStorageClient().send(
    new DeleteObjectCommand({ Bucket: config.bucketName, Key: normalizeAssetKey(runtimePath) }),
  );
};

interface ImageAssetEntry {
  fileName: string;
  version?: string;
}

const listImageAssetEntries = async (runtimeDirectory: string): Promise<ImageAssetEntry[]> => {
  const config = getObjectStorageConfig();
  if (!config) {
    try {
      const entries = await fs.promises.readdir(getLocalImageAssetPath(`${runtimeDirectory}/.`), {
        withFileTypes: true,
      });
      return await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const runtimePath = `${runtimeDirectory}/${entry.name}`;
            const stats = await fs.promises.stat(getLocalImageAssetPath(runtimePath));
            return { fileName: entry.name, version: String(stats.mtimeMs) };
          }),
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
  }

  const prefix = `${normalizeAssetKey(`${runtimeDirectory}/.`).replace(/\/\.$/, '')}/`;
  const entries: ImageAssetEntry[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await getObjectStorageClient().send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of response.Contents ?? []) {
      const relativeKey = object.Key?.slice(prefix.length);
      if (relativeKey && !relativeKey.includes('/')) {
        entries.push({
          fileName: relativeKey,
          version: normalizeAssetVersion(object.ETag, object.LastModified),
        });
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return entries;
};

export const listImageAssetFileNames = async (runtimeDirectory: string): Promise<string[]> =>
  (await listImageAssetEntries(runtimeDirectory)).map((entry) => entry.fileName);

export const getCharacterImageStorageDir = (characterId: string): string =>
  path.join(getLocalImageStorageRoot(), stripAssetPrefix(RUNTIME_CHARACTER_IMAGE_DIR), characterId);

export const getLoreImageStorageDir = (loreId: string): string =>
  path.join(getLocalImageStorageRoot(), stripAssetPrefix(RUNTIME_CHARACTER_IMAGE_DIR), 'lore', loreId);

export const getUserImageStorageDir = (userId: string): string =>
  path.join(getLocalImageStorageRoot(), stripAssetPrefix(RUNTIME_USER_IMAGE_DIR), userId);

export const getProfileImageStorageDir = (profileId: string): string =>
  path.join(getLocalImageStorageRoot(), stripAssetPrefix(RUNTIME_PROFILE_IMAGE_DIR), profileId);

const toAssetUrl = (...segments: string[]): string =>
  `${RUNTIME_CHARACTER_IMAGE_DIR}/${segments.map(encodeURIComponent).join('/')}`;

const assetUrlEndsWithExtension = (assetUrl: string, extension: string): boolean =>
  assetUrl.split('?', 1)[0].endsWith(extension);

export const buildCharacterPortraitUrls = (
  characterId: string,
  fileNames: readonly string[],
  versions: Readonly<Record<string, string>> = {},
): PortraitUrlMap => {
  const portraitUrls: PortraitUrlMap = {};
  const preferredExtension = `.${IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.format}`;
  const characterPrefix = `${characterId}_`;

  for (const fileName of [...fileNames].sort()) {
    if (!fileName.startsWith(characterPrefix)) continue;

    const match = fileName.slice(characterPrefix.length).match(/^(\d+)(\.[^.]+)$/);
    if (!match) continue;

    const parsedEmotionKey = Number(match[1]);
    const extension = match[2].toLowerCase();
    if (!validEmotionKeys.has(parsedEmotionKey as EmotionKey) || !SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      continue;
    }
    const emotionKey = parsedEmotionKey as EmotionKey;

    const existingUrl = portraitUrls[emotionKey];
    if (existingUrl && assetUrlEndsWithExtension(existingUrl, preferredExtension) && extension !== preferredExtension) {
      continue;
    }

    portraitUrls[emotionKey] = appendImageAssetVersion(toAssetUrl(characterId, fileName), versions[fileName]);
  }

  return portraitUrls;
};

export const buildCharacterAvatarUrls = (
  characterId: string,
  fileNames: readonly string[],
  versions: Readonly<Record<string, string>> = {},
): PortraitUrlMap => {
  const avatarUrls: PortraitUrlMap = {};
  const preferredExtension = `.${IMAGE_PROCESSING_CONFIG.CHARACTER_AVATAR.format}`;
  const characterPrefix = `${characterId}_`;

  for (const fileName of [...fileNames].sort()) {
    if (!fileName.startsWith(characterPrefix)) continue;
    const match = fileName.slice(characterPrefix.length).match(/^(\d+)_a(\.[^.]+)$/);
    if (!match) continue;

    const parsedEmotionKey = Number(match[1]);
    const extension = match[2].toLowerCase();
    if (!validEmotionKeys.has(parsedEmotionKey as EmotionKey) || !SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      continue;
    }
    const emotionKey = parsedEmotionKey as EmotionKey;
    const existingUrl = avatarUrls[emotionKey];
    if (existingUrl && assetUrlEndsWithExtension(existingUrl, preferredExtension) && extension !== preferredExtension) {
      continue;
    }
    avatarUrls[emotionKey] = appendImageAssetVersion(toAssetUrl(characterId, fileName), versions[fileName]);
  }

  return avatarUrls;
};

export const getCharacterPortraitUrls = async (characterId: string): Promise<PortraitUrlMap> => {
  const entries = await listImageAssetEntries(`${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}`);
  return buildCharacterPortraitUrls(
    characterId,
    entries.map((entry) => entry.fileName),
    Object.fromEntries(entries.map((entry) => [entry.fileName, entry.version || ''])),
  );
};

export const getCharacterAvatarUrls = async (characterId: string): Promise<PortraitUrlMap> => {
  const entries = await listImageAssetEntries(`${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}`);
  return buildCharacterAvatarUrls(
    characterId,
    entries.map((entry) => entry.fileName),
    Object.fromEntries(entries.map((entry) => [entry.fileName, entry.version || ''])),
  );
};

export const getProfileImageUrls = async (profileId: string): Promise<{ portraitUrl?: string; avatarUrl?: string }> => {
  const entries = await listImageAssetEntries(`${RUNTIME_PROFILE_IMAGE_DIR}/${profileId}`);
  const buildUrl = (preferredFileName: string, legacyFileName: string) => {
    const entry =
      entries.find((candidate) => candidate.fileName === preferredFileName) ??
      entries.find((candidate) => candidate.fileName === legacyFileName);
    return entry
      ? appendImageAssetVersion(
          `${RUNTIME_PROFILE_IMAGE_DIR}/${encodeURIComponent(profileId)}/${encodeURIComponent(entry.fileName)}`,
          entry.version,
        )
      : undefined;
  };
  return {
    portraitUrl: buildUrl(`${profileId}_0.webp`, 'portrait.webp'),
    avatarUrl: buildUrl(`${profileId}_0_a.webp`, 'avatar.webp'),
  };
};

export const getProfilePortraitUrl = (profileId: string): Promise<string | undefined> =>
  getProfileImageUrls(profileId).then(({ portraitUrl }) => portraitUrl);

export const getProfileAvatarUrl = (profileId: string): Promise<string | undefined> =>
  getProfileImageUrls(profileId).then(({ avatarUrl }) => avatarUrl);

export const getHistoryImageUrl = async (characterId: string, historyId: string): Promise<string | undefined> => {
  const entries = await listImageAssetEntries(`${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}/lore`);
  return buildHistoryImageUrl(
    characterId,
    historyId,
    entries.map((entry) => entry.fileName),
    Object.fromEntries(entries.map((entry) => [entry.fileName, entry.version || ''])),
  );
};

export const buildHistoryImageUrl = (
  characterId: string,
  historyId: string,
  fileNames: readonly string[],
  versions: Readonly<Record<string, string>> = {},
): string | undefined => {
  const preferredExtension = `.${IMAGE_PROCESSING_CONFIG.LORE_IMAGE.format}`;
  const matchingFiles = fileNames
    .filter((fileName) => path.parse(fileName).name === historyId)
    .filter((fileName) => SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(fileName).toLowerCase()))
    .sort((left, right) => Number(right.endsWith(preferredExtension)) - Number(left.endsWith(preferredExtension)));

  return matchingFiles[0]
    ? appendImageAssetVersion(toAssetUrl(characterId, 'lore', matchingFiles[0]), versions[matchingFiles[0]])
    : undefined;
};
