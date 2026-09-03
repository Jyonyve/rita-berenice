import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CHAT_DISPLAY_MODE,
  getChatDisplayModeStorageKey,
  readChatDisplayMode,
  writeChatDisplayMode,
} from './chatDisplayMode.js';
import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_FONT_WEIGHT,
  MAX_CHAT_FONT_SIZE,
  MIN_CHAT_FONT_SIZE,
  getChatFontSizeStorageKey,
  getChatFontWeightStorageKey,
  readChatFontSize,
  readChatFontWeight,
  writeChatFontSize,
  writeChatFontWeight,
} from './chatFontSize.js';

test('chat display mode defaults to book and persists valid preferences', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const key = getChatDisplayModeStorageKey('user-1');

  assert.equal(readChatDisplayMode(storage, key), DEFAULT_CHAT_DISPLAY_MODE);
  writeChatDisplayMode(storage, key, 'conversation');
  assert.equal(readChatDisplayMode(storage, key), 'conversation');
  values.set(key, 'unsupported');
  assert.equal(readChatDisplayMode(storage, key), DEFAULT_CHAT_DISPLAY_MODE);
});

test('chat font weight defaults to normal and persists bold preferences', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const key = getChatFontWeightStorageKey('user-1');

  assert.equal(readChatFontWeight(storage, key), DEFAULT_CHAT_FONT_WEIGHT);
  writeChatFontWeight(storage, key, 'bold');
  assert.equal(readChatFontWeight(storage, key), 'bold');
  values.set(key, 'unsupported');
  assert.equal(readChatFontWeight(storage, key), DEFAULT_CHAT_FONT_WEIGHT);
});

test('chat font size defaults to medium and persists valid preferences', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const key = getChatFontSizeStorageKey('user-1');

  assert.equal(readChatFontSize(storage, key), DEFAULT_CHAT_FONT_SIZE);
  writeChatFontSize(storage, key, 18);
  assert.equal(readChatFontSize(storage, key), 18);
  values.set(key, 'small');
  assert.equal(readChatFontSize(storage, key), 14);
  values.set(key, '999');
  assert.equal(readChatFontSize(storage, key), MAX_CHAT_FONT_SIZE);
  values.set(key, '-1');
  assert.equal(readChatFontSize(storage, key), MIN_CHAT_FONT_SIZE);
  values.set(key, 'unsupported');
  assert.equal(readChatFontSize(storage, key), DEFAULT_CHAT_FONT_SIZE);
});
