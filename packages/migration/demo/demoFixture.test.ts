import assert from 'node:assert/strict';
import test from 'node:test';
import { documentInfoSchema } from '@rita-berenice/shared/domain';
import { buildPublicDemoFixture, PUBLIC_DEMO_IDS } from './demoFixture.js';

/**
 * The public demo fixture is the only seed data that ships to the public
 * instance, so these tests are written as an allow list: every identifier and
 * address the fixture produces must fall inside a namespace that is safe to
 * publish. A deny list would have to name the private values it excludes, which
 * would leak them into this repository.
 */
const DEMO_USER_ID = 'public_demo_user';
const DEMO_ID_PREFIX = 'seoha_public_demo';
const DEMO_EMAIL_DOMAIN = '@local.invalid';

const ID_KEY_PATTERN = /^id$|Id$|Ids$|IdList$/;

const collectIdValues = (node: unknown, key: string | null, found: string[]): void => {
	if (typeof node === 'string') {
		if (key !== null && ID_KEY_PATTERN.test(key)) found.push(node);
		return;
	}
	if (Array.isArray(node)) {
		for (const item of node) collectIdValues(item, key, found);
		return;
	}
	if (node !== null && typeof node === 'object') {
		for (const [childKey, value] of Object.entries(node)) {
			collectIdValues(value, childKey, found);
		}
	}
};

const collectEmails = (node: unknown, found: string[]): void => {
	if (typeof node === 'string') {
		for (const match of node.match(/[\w.+-]+@[\w.-]+/g) ?? []) found.push(match);
		return;
	}
	if (Array.isArray(node)) {
		for (const item of node) collectEmails(item, found);
		return;
	}
	if (node !== null && typeof node === 'object') {
		for (const value of Object.values(node)) collectEmails(value, found);
	}
};

test('every fixture identifier stays inside the public demo namespace', () => {
	const fixture = buildPublicDemoFixture();

	const ids: string[] = [];
	collectIdValues(fixture, null, ids);

	// Guard against the walker silently matching nothing and passing vacuously.
	assert.ok(ids.length > 50, `expected the fixture to expose many ids, got ${ids.length}`);

	const outsideNamespace = [...new Set(ids)].filter(
		(id) => id !== DEMO_USER_ID && !id.startsWith(DEMO_ID_PREFIX)
	);
	assert.deepEqual(outsideNamespace, []);

	for (const declaredId of Object.values(PUBLIC_DEMO_IDS)) {
		assert.equal(declaredId === DEMO_USER_ID || declaredId.startsWith(DEMO_ID_PREFIX), true);
	}

	assert.equal(fixture.user.userId, DEMO_USER_ID);
	assert.equal(fixture.character.userId, DEMO_USER_ID);
	assert.equal(fixture.session.userId, DEMO_USER_ID);
	assert.equal(fixture.profile.userId, DEMO_USER_ID);
	assert.equal(fixture.session.sessionId, PUBLIC_DEMO_IDS.sessionId);
	assert.equal(fixture.character.worldLoreId, PUBLIC_DEMO_IDS.worldLoreId);
});

test('every address in the fixture uses the reserved invalid domain', () => {
	const fixture = buildPublicDemoFixture();

	const emails: string[] = [];
	collectEmails(fixture, emails);

	assert.equal(emails.length > 0, true);
	for (const email of emails) {
		assert.equal(email.endsWith(DEMO_EMAIL_DOMAIN), true, `unexpected address: ${email}`);
	}
	assert.equal(fixture.user.email.endsWith(DEMO_EMAIL_DOMAIN), true);
});

test('the fixture carries no credential-shaped material', () => {
	const serialized = JSON.stringify(buildPublicDemoFixture()).toLowerCase();

	const secretPatterns: [string, RegExp][] = [
		['openai-style key', /sk-[a-z0-9]/],
		['aws access key id', /akia[a-z0-9]/],
		['slack token', /xox[abpsr]-/],
		['api key field', /api[_-]?key/],
		['secret field', /secret/],
		['bearer credential', /bearer\s+\S/],
		['authorization header', /authorization/],
		['password field', /password|passwd/],
		['postgres connection string', /postgres(ql)?:\/\//],
		['mysql connection string', /mysql:\/\//],
		['mongodb connection string', /mongodb(\+srv)?:\/\//],
		['redis connection string', /redis:\/\//],
		['pem private key', /-----begin [a-z ]*private key/],
		['json web token', /eyj[a-z0-9_-]{10,}/],
	];

	for (const [label, pattern] of secretPatterns) {
		assert.equal(pattern.test(serialized), false, `fixture matched ${label}`);
	}

	// The fixture is offline sample data: it must not reach out anywhere.
	assert.equal(/https?:\/\//.test(serialized), false);
});

test('public demo fixture is deterministic', () => {
	assert.deepEqual(buildPublicDemoFixture(), buildPublicDemoFixture());
});

test('conversation turns are contiguous and fully annotated', () => {
	const fixture = buildPublicDemoFixture();

	assert.equal(fixture.turns.length, 6);
	assert.equal(
		fixture.turns.every((turn, index) => turn.sequence === index),
		true
	);
	assert.equal(
		fixture.turns.every(
			(turn) =>
				turn.summary !== 'N/A' &&
				turn.memoryChunk !== 'N/A' &&
				turn.keywordList.length > 0 &&
				turn.topicList.length > 0 &&
				turn.entityList.length > 0
		),
		true
	);
	assert.equal(
		fixture.turns.every(
			(turn) =>
				turn.sessionId === PUBLIC_DEMO_IDS.sessionId && turn.characterId === PUBLIC_DEMO_IDS.characterId
		),
		true
	);
});

test('narrative records are populated and scoped to the demo session', () => {
	const fixture = buildPublicDemoFixture();

	assert.equal(fixture.lores.length, 2);
	assert.equal(fixture.histories.length, 1);
	assert.equal(fixture.recaps.length, 2);
	assert.equal(fixture.terms.length, 2);
	assert.equal(fixture.session.contentPolicy, 'general');
	// 'active' keeps the session visible in the character page's session list, which
	// filters on this value; the demo account continues the conversation from there.
	assert.equal(fixture.session.status, 'active');
	// buildCharacterId(name, variant) joins with '_', so this has to round-trip.
	assert.equal(`seoha_${fixture.character.variant}`, fixture.character.characterId);
	assert.deepEqual(fixture.credentialMetadata.configuredKeyTypes, []);

	assert.equal(
		[...fixture.lores, ...fixture.histories, ...fixture.recaps].every(
			(source) => source.userId === DEMO_USER_ID && source.content.trim().length > 0
		),
		true
	);
	assert.equal(
		fixture.recaps.every(
			(recap) => recap.sessionId === PUBLIC_DEMO_IDS.sessionId && recap.turnEnd < fixture.turns.length
		),
		true
	);
	assert.equal(
		fixture.terms.every((term) => term.sessionId === PUBLIC_DEMO_IDS.sessionId),
		true
	);

	assert.equal(fixture.finalizationJobs.length, 1);
	assert.equal(fixture.finalizationJobs[0].status, 'completed');
	assert.equal(fixture.finalizationJobs[0].result.chatTurnId, fixture.turns.at(-1)?.chatTurnId);
});

test('documents cover every origin, status and retrieval combination', () => {
	const fixture = buildPublicDemoFixture();

	assert.equal(fixture.documents.length, 5);
	assert.equal(new Set(fixture.documents.map((document) => document.documentId)).size, 5);
	assert.equal(
		fixture.documents.every(
			(document) =>
				document.userId === DEMO_USER_ID &&
				document.sessionId === PUBLIC_DEMO_IDS.sessionId &&
				document.characterId === PUBLIC_DEMO_IDS.characterId &&
				documentInfoSchema.safeParse(document).success
		),
		true
	);

	const byId = (documentId: string) =>
		fixture.documents.find((document) => document.documentId === documentId)!;

	const manualDraft = byId(PUBLIC_DEMO_IDS.manualDraftDocumentId);
	assert.equal(manualDraft.origin, 'manual');
	assert.equal(manualDraft.status, 'draft');
	assert.equal(manualDraft.retrievalEnabled, false);

	const generatedDraft = byId(PUBLIC_DEMO_IDS.generatedDraftDocumentId);
	assert.equal(generatedDraft.origin, 'generated');
	assert.equal(generatedDraft.status, 'draft');
	assert.equal(generatedDraft.retrievalEnabled, false);
	assert.equal(generatedDraft.includeInRag, true);
	assert.equal(generatedDraft.modelName, 'fixture-model');
	assert.equal(generatedDraft.promptVersion, 'in-world-document-generation-v1');
	assert.equal(Boolean(generatedDraft.requestText), true);

	const approvedRag = byId(PUBLIC_DEMO_IDS.approvedRagDocumentId);
	assert.equal(approvedRag.status, 'approved');
	assert.equal(approvedRag.includeInRag, true);
	assert.equal(approvedRag.retrievalEnabled, true);

	const approvedNoRag = byId(PUBLIC_DEMO_IDS.approvedNoRagDocumentId);
	assert.equal(approvedNoRag.status, 'approved');
	assert.equal(approvedNoRag.includeInRag, false);
	assert.equal(approvedNoRag.retrievalEnabled, false);

	const archived = byId(PUBLIC_DEMO_IDS.archivedDocumentId);
	assert.equal(archived.status, 'archived');
	assert.equal(archived.includeInRag, false);
	assert.equal(archived.retrievalEnabled, false);
});
