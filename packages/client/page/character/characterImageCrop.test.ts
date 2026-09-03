import assert from 'node:assert/strict';
import test from 'node:test';
import { ASPECT_RATIOS } from '@rita-berenice/shared/config';
import { IMAGE_PROCESSING_CONFIG } from '@rita-berenice/shared/config';
import { getCharacterCropAspect, getCharacterCropOutputSize } from './characterImageCrop.js';

test('character image crop uses portrait and square avatar aspect ratios', () => {
  assert.equal(getCharacterCropAspect('portrait'), ASPECT_RATIOS.CHARACTER);
  assert.equal(getCharacterCropAspect('avatar'), ASPECT_RATIOS.USER);
});

test('character image crops are bounded to the server output dimensions', () => {
  assert.deepEqual(getCharacterCropOutputSize('portrait'), IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.dimensions);
  assert.deepEqual(getCharacterCropOutputSize('avatar'), IMAGE_PROCESSING_CONFIG.CHARACTER_AVATAR.dimensions);
});
