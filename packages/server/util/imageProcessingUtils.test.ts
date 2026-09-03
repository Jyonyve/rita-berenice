import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { processCharacterImagePair, processProfileImagePair, processUserAvatar } from './imageProcessingUtils.js';
import {
  getCharacterImageStorageDir,
  getProfileImageStorageDir,
  getProfileImageUrls,
  getUserImageStorageDir,
} from './imageStorageUtils.js';

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rita-image-crop-'));
process.env.LOCAL_IMAGE_STORAGE_DIR = storageRoot;

test.after(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

const makeImage = async (
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha: number } = {
    r: 80,
    g: 120,
    b: 160,
    alpha: 1,
  },
): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toBuffer();

const assertPairDimensions = async (characterId: string): Promise<void> => {
  const directory = getCharacterImageStorageDir(characterId);
  const portraitPath = path.join(directory, `${characterId}_0.webp`);
  const avatarPath = path.join(directory, `${characterId}_0_a.webp`);
  const portraitBuffer = await fs.readFile(portraitPath);
  const avatarBuffer = await fs.readFile(avatarPath);
  const portrait = await sharp(portraitBuffer).metadata();
  const avatar = await sharp(avatarBuffer).metadata();

  assert.deepEqual({ width: portrait.width, height: portrait.height }, { width: 500, height: 700 });
  assert.deepEqual({ width: avatar.width, height: avatar.height }, { width: 512, height: 512 });
  assert.notEqual(portraitBuffer.indexOf('VP8L'), -1);
  assert.notEqual(avatarBuffer.indexOf('VP8L'), -1);
};

test('character image pair processing accepts common dimensions and very small images', async () => {
  const cases = [
    { name: 'portrait', width: 500, height: 700 },
    { name: 'landscape', width: 900, height: 500 },
    { name: 'square', width: 600, height: 600 },
    { name: 'very-small', width: 8, height: 8 },
  ];

  for (const imageCase of cases) {
    const input = await makeImage(imageCase.width, imageCase.height);
    await processCharacterImagePair(input, input, `crop-${imageCase.name}`, 0);
    await assertPairDimensions(`crop-${imageCase.name}`);
  }
});

test('character image pair processing preserves transparency', async () => {
  const input = await makeImage(320, 320, { r: 0, g: 0, b: 0, alpha: 0 });
  const characterId = 'crop-transparent';
  await processCharacterImagePair(input, input, characterId, 0);

  const directory = getCharacterImageStorageDir(characterId);
  const portrait = await sharp(path.join(directory, `${characterId}_0.webp`)).metadata();
  const avatar = await sharp(path.join(directory, `${characterId}_0_a.webp`)).metadata();

  assert.equal(portrait.hasAlpha, true);
  assert.equal(avatar.hasAlpha, true);
});

test('user avatar processing returns a versioned URL while keeping a deterministic file path', async () => {
  const input = await makeImage(320, 320);
  const userId = 'avatar-cache-user';
  const avatarUrl = await processUserAvatar(input, userId);

  assert.match(avatarUrl, /^\/assets\/user\/avatar-cache-user\/image\.webp\?v=\d+(?:\.\d+)?$/);
  const metadata = await sharp(path.join(getUserImageStorageDir(userId), 'image.webp')).metadata();
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 512, height: 512 });
});

test('session profile processing stores a 5:7 portrait and independent square avatar', async () => {
  const profileId = 'session-profile-image';
  const input = await makeImage(900, 600);
  await processProfileImagePair(input, input, profileId);

  const directory = getProfileImageStorageDir(profileId);
  const portrait = await sharp(path.join(directory, `${profileId}_0.webp`)).metadata();
  const avatar = await sharp(path.join(directory, `${profileId}_0_a.webp`)).metadata();
  assert.deepEqual({ width: portrait.width, height: portrait.height }, { width: 500, height: 700 });
  assert.deepEqual({ width: avatar.width, height: avatar.height }, { width: 512, height: 512 });

  const urls = await getProfileImageUrls(profileId);
  assert.match(urls.portraitUrl ?? '', /^\/assets\/profile\/session-profile-image\/session-profile-image_0\.webp\?v=/);
  assert.match(urls.avatarUrl ?? '', /^\/assets\/profile\/session-profile-image\/session-profile-image_0_a\.webp\?v=/);
});

test('profile image discovery remains compatible with the original fixed filenames', async () => {
  const profileId = 'legacy-profile-image';
  const directory = getProfileImageStorageDir(profileId);
  await fs.mkdir(directory, { recursive: true });
  const input = await makeImage(32, 32);
  await Promise.all([
    fs.writeFile(path.join(directory, 'portrait.webp'), input),
    fs.writeFile(path.join(directory, 'avatar.webp'), input),
  ]);

  const urls = await getProfileImageUrls(profileId);
  assert.match(urls.portraitUrl ?? '', /\/portrait\.webp\?v=/);
  assert.match(urls.avatarUrl ?? '', /\/avatar\.webp\?v=/);
});

test('character image processing accepts multiple, edge, and absent subject cues without detection', async () => {
  const subjectCases = [
    {
      name: 'multiple-subjects',
      svg: '<svg width="400" height="400"><rect width="400" height="400" fill="white"/><circle cx="100" cy="200" r="70" fill="red"/><circle cx="300" cy="200" r="70" fill="blue"/></svg>',
    },
    {
      name: 'edge-subject',
      svg: '<svg width="400" height="400"><rect width="400" height="400" fill="white"/><circle cx="35" cy="200" r="35" fill="red"/></svg>',
    },
    {
      name: 'no-subject',
      svg: '<svg width="400" height="400"><rect width="400" height="400" fill="#808080"/></svg>',
    },
  ];

  for (const subjectCase of subjectCases) {
    const input = await sharp(Buffer.from(subjectCase.svg)).png().toBuffer();
    await processCharacterImagePair(input, input, `crop-${subjectCase.name}`, 0);
    await assertPairDimensions(`crop-${subjectCase.name}`);
  }
});

test('character image processing stores only the cropped pair and preserves it after decode failure', async () => {
  const characterId = 'crop-failure';
  const input = await makeImage(500, 700);
  await processCharacterImagePair(input, input, characterId, 0);

  const directory = getCharacterImageStorageDir(characterId);
  const portraitPath = path.join(directory, `${characterId}_0.webp`);
  const avatarPath = path.join(directory, `${characterId}_0_a.webp`);
  const filesBefore = (await fs.readdir(directory)).sort();
  const portraitBefore = await fs.readFile(portraitPath);
  const avatarBefore = await fs.readFile(avatarPath);

  assert.deepEqual(filesBefore, [`${characterId}_0.webp`, `${characterId}_0_a.webp`]);
  await assert.rejects(() =>
    processCharacterImagePair(Buffer.from('invalid image'), Buffer.from('invalid image'), characterId, 0),
  );
  assert.deepEqual(await fs.readFile(portraitPath), portraitBefore);
  assert.deepEqual(await fs.readFile(avatarPath), avatarBefore);
});
