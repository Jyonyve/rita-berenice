import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRecord, parseRecords } from './extractChatLogs.js';

test('parseRecords accepts the observed array response and common envelopes', () => {
	assert.equal(parseRecords('[{"log_id":"one"}]').length, 1);
	assert.equal(parseRecords('{"data":[{"log_id":"one"}]}').length, 1);
	assert.equal(parseRecords('{"records":[{"log_id":"one"}]}').length, 1);
	assert.equal(parseRecords('{"episodes":[{"episode_id":"one"}]}').length, 1);
	assert.equal(parseRecords('{"result":{"data":[{"log_id":"one"}]}}').length, 1);
	assert.throws(() => parseRecords('{"unexpected":[]}'), /no record array/);
});

test('normalizeRecord preserves branch and unrecognized metadata separately', () => {
	const normalized = normalizeRecord(
		{
			pk: 1,
			log_id: 'log-1',
			user_chat: '안녕하세요',
			bot_chat: '반갑습니다',
			created_at: '2025-01-01T00:00:00Z',
			parent_log_id: 'log-0',
			model: 'example',
		},
		{ file: 'raw/page-0000000000.json', offset: 0 },
		0
	);
	assert.equal(normalized.created, '2025-01-01T00:00:00Z');
	assert.equal(normalized.branch_metadata.parent_log_id, 'log-0');
	assert.equal(normalized.additional_metadata.model, 'example');
	assert.equal(normalized.source.index_in_page, 0);
});

test('parseRecords accepts an episode summary response', () => {
	const records = parseRecords(
		JSON.stringify({
			episodes: [{ episode_id: '7527179', title: '과거의 그림자와 위로', summary: '요약' }],
			hasMore: true,
		})
	);
	assert.equal(records[0]?.episode_id, '7527179');
});
