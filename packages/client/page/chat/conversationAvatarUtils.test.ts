import assert from 'node:assert/strict';
import test from 'node:test';
import { getConversationAvatar } from './conversationAvatarUtils.js';

test('conversation avatar uses the avatar paired with the response emotion', () => {
  assert.equal(
    getConversationAvatar(
      { 0: '/neutral-avatar.avif', 2: '/angry-avatar.avif' },
      { 0: '/neutral-full.avif', 2: '/angry-full.avif' },
      'anger',
    ),
    '/angry-avatar.avif',
  );
});

test('conversation avatar falls back to the same emotion full portrait for legacy assets', () => {
  assert.equal(
    getConversationAvatar({ 0: '/neutral-avatar.avif' }, { 0: '/neutral-full.avif', 2: '/angry-full.avif' }, 'anger'),
    '/angry-full.avif',
  );
});

test('conversation avatar uses a related positive image when the exact emotion image is missing', () => {
  assert.equal(
    getConversationAvatar(
      { 0: '/neutral-avatar.avif', 1: '/happy-avatar.avif', 2: '/angry-avatar.avif' },
      undefined,
      'romantic',
    ),
    '/happy-avatar.avif',
  );
});

test('conversation avatar uses a related tense image when the exact emotion image is missing', () => {
  assert.equal(
    getConversationAvatar(
      { 0: '/neutral-avatar.avif', 1: '/happy-avatar.avif', 2: '/angry-avatar.avif' },
      undefined,
      'disgusted',
    ),
    '/angry-avatar.avif',
  );
});
