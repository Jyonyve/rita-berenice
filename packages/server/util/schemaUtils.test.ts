import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatTurnCdo } from '@rita-berenice/shared/domain';
import { createBasicChatTurn } from '@rita-berenice/shared/util';
import { ChatTurnCdoSchema } from './schemaUtils.js';

const sessionId = 'monday_original_1sYD76a4';

const buildMessage = (messageType: 'request' | 'response') => ({
	role: messageType === 'request' ? ('user' as const) : ('assistant' as const),
	type: 'message',
	model: messageType === 'request' ? '' : 'gpt-4o-mini',
	emotion: 'neutral',
	entries: [{ type: 'dialogue' as const, prompt: 'Hello' }],
	sequence: 9,
	showName: messageType === 'request' ? 'User' : 'Monday',
	createdAt: '',
	messageId: '',
	sessionId,
	updatedAt: '',
	messageType,
});

test('ChatTurnCdoSchema accepts lifecycle placeholders from temporary turns', () => {
	const result = ChatTurnCdoSchema.safeParse({
		userId: 'user-1',
		sessionId,
		sequence: 9,
		request: buildMessage('request'),
		response: buildMessage('response'),
	});

	assert.equal(result.success, true);
	if (!result.success) return;

	const turn = createBasicChatTurn(result.data as ChatTurnCdo);
	assert.equal(turn.request.messageId, `${sessionId}_9_request`);
	assert.equal(turn.response.messageId, `${sessionId}_9_response`);
	assert.notEqual(turn.request.createdAt, '');
	assert.notEqual(turn.request.updatedAt, '');
	assert.notEqual(turn.response.createdAt, '');
	assert.notEqual(turn.response.updatedAt, '');
});

test('ChatTurnCdoSchema still rejects mismatched nested message identity', () => {
	const result = ChatTurnCdoSchema.safeParse({
		userId: 'user-1',
		sessionId,
		sequence: 9,
		request: { ...buildMessage('request'), sequence: 8 },
		response: buildMessage('response'),
	});

	assert.equal(result.success, false);
});
