import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DEFAULT_EMOTION, METADATA_TYPES, NA, validEmotions } from '@rita-berenice/shared/config';
import {
	ChatMessage,
	ChatTurn,
	EmotionValue,
	MigChatMessage,
	ProfileInfo,
	SessionInfo,
	UserInfo,
} from '@rita-berenice/shared/domain';
import {
	buildChatTurnId,
	buildMessageId,
	buildProfileId,
	getAiModelInfo,
} from '@rita-berenice/shared/util';
import { closeDatabase, getDatabase } from '@rita-berenice/server/db';
import { memoryEngine, personaEngine } from '@rita-berenice/server/service';
import {
	characterStore,
	chatStore,
	profileStore,
	sessionStore,
	userStore,
} from '@rita-berenice/server/store';
import { detectLanguage, parseConversationToEntries } from '@rita-berenice/server/util';
import { mondayOriginal } from '../character/migrationTemplates.js';
import { USER_ID } from '../userId.js';

const SESSION_ID = 'monday_original_1sYD76a4';
const SOURCE_FILE = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../logs/OLD/log/monday_original_20250418T000000_9.json'
);

const rawMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	messageType: z.enum(['request', 'response']),
	name: z.string().min(1),
	showName: z.string().min(1),
	emotion: z.string().default(DEFAULT_EMOTION),
	content: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	uuid: z.string(),
	index: z.union([z.string(), z.number()]),
	model: z.string().optional(),
});

const readRawMessages = async (): Promise<MigChatMessage[]> => {
	const source = await fs.readFile(SOURCE_FILE, 'utf8');
	const parsed = z.array(rawMessageSchema).parse(JSON.parse(source));
	if (parsed.length === 0 || parsed.length % 2 !== 0) {
		throw new Error(`Expected a non-empty even number of messages, received ${parsed.length}.`);
	}
	return parsed.map((message) => ({ ...message, index: Number(message.index) }));
};

const normalizeEmotion = (value: string): EmotionValue =>
	(validEmotions.has(value) ? value : DEFAULT_EMOTION) as EmotionValue;

const toChatMessage = (
	raw: MigChatMessage,
	sequence: number,
	messageType: 'request' | 'response'
): ChatMessage => ({
	sessionId: SESSION_ID,
	sequence,
	messageType,
	role: raw.role,
	showName: raw.showName,
	messageId: buildMessageId(SESSION_ID, sequence, messageType),
	createdAt: raw.createdAt,
	updatedAt: raw.updatedAt,
	emotion: normalizeEmotion(raw.emotion),
	type: METADATA_TYPES.MESSAGE,
	model: raw.model ?? 'none',
	entries: parseConversationToEntries(raw.content),
});

const normalizeTurns = (messages: MigChatMessage[]): ChatTurn[] => {
	const turns: ChatTurn[] = [];
	for (let offset = 0; offset < messages.length; offset += 2) {
		const request = messages[offset];
		const response = messages[offset + 1];
		const sequence = offset / 2;
		if (request.role !== 'user' || request.messageType !== 'request') {
			throw new Error(`Message ${offset} must be a user request.`);
		}
		if (response.role !== 'assistant' || response.messageType !== 'response') {
			throw new Error(`Message ${offset + 1} must be an assistant response.`);
		}

		turns.push({
			type: METADATA_TYPES.TURN,
			chatTurnId: buildChatTurnId(SESSION_ID, sequence),
			sessionId: SESSION_ID,
			characterId: mondayOriginal.characterId,
			userId: USER_ID,
			profileId: buildProfileId(SESSION_ID, USER_ID),
			sequence,
			createdAt: request.createdAt,
			updatedAt: response.updatedAt,
			summary: NA,
			memoryChunk: NA,
			dialogueAct: NA,
			keywordList: [],
			topicList: [],
			entityList: [],
			actionList: [],
			flagList: [],
			relationshipShiftList: [],
			userEmotion: { primary: normalizeEmotion(request.emotion), intensity: 0.5, nuanceList: [] },
			characterEmotion: {
				primary: normalizeEmotion(response.emotion),
				intensity: 0.5,
				nuanceList: [],
			},
			loreReferenceList: [],
			historyReferenceList: [],
			request: toChatMessage(request, sequence, 'request'),
			response: toChatMessage(response, sequence, 'response'),
		});
	}
	return turns;
};

const buildSeedRecords = (turns: ChatTurn[]) => {
	const first = turns[0];
	const last = turns.at(-1)!;
	const now = new Date().toISOString();
	const user: UserInfo = {
		userId: USER_ID,
		email: 'monday-import@local.invalid',
		gender: 'nocomment',
		title: '',
		showName: first.request.showName,
		contact: '',
		createdAt: first.createdAt,
		updatedAt: now,
		type: METADATA_TYPES.USER,
		avatarUrl: '',
	};
	const session: SessionInfo = {
		sessionId: SESSION_ID,
		userId: USER_ID,
		profileId: buildProfileId(SESSION_ID, USER_ID),
		characterId: mondayOriginal.characterId,
		title: `${mondayOriginal.showName} chat`,
		createdAt: first.createdAt,
		updatedAt: last.updatedAt,
		messageCount: turns.length,
		status: 'active',
		type: METADATA_TYPES.SESSION,
		lastCharMessage: last.response.entries.map((entry) => entry.prompt).join('\n'),
		userNote: '',
	};
	const profile: ProfileInfo = {
		profileId: session.profileId,
		sessionId: SESSION_ID,
		userId: USER_ID,
		name: first.request.showName,
		showName: first.request.showName,
		gender: 'nocomment',
		title: '',
		description: 'Imported profile for the original Monday conversation.',
		createdAt: first.createdAt,
		updatedAt: now,
		type: METADATA_TYPES.PROFILE,
	};
	return { user, session, profile };
};

const validate = async () => {
	const messages = await readRawMessages();
	const turns = normalizeTurns(messages);
	console.log(
		JSON.stringify(
			{
				source: path.relative(process.cwd(), SOURCE_FILE),
				messages: messages.length,
				turns: turns.length,
				sessionId: SESSION_ID,
				sequences: turns.map((turn) => turn.sequence),
			},
			null,
			2
		)
	);
	return turns;
};

const importMonday = async () => {
	const turns = await validate();
	const { user, session, profile } = buildSeedRecords(turns);

	await userStore.storeUser(user);
	await characterStore.storeCharacter(mondayOriginal);
	await sessionStore.storeSession(session);
	await profileStore.storeProfile(profile);
	await chatStore.storeChatTurns(turns);

	const db = getDatabase();
	const storedTurns = await db.query.chatTurns.findMany({
		where: (table, { eq }) => eq(table.sessionId, SESSION_ID),
	});
	const embeddings = await db.query.memoryEmbeddings.findMany({
		where: (table, { and, eq }) =>
			and(eq(table.sourceType, 'chat'), eq(table.sessionId, SESSION_ID), eq(table.active, true)),
	});
	console.log(
		JSON.stringify(
			{
				imported: true,
				sessionId: SESSION_ID,
				storedTurns: storedTurns.length,
				activeEmbeddings: embeddings.length,
			},
			null,
			2
		)
	);
};

const recallMonday = async () => {
	const query = 'TypeScript와 Java를 사용하는 AI 개발자의 이야기';
	const response = await chatStore.queryChatTurns(SESSION_ID, [query], undefined, undefined, 3);
	const sequences = response.chatTurns.map((turn) => turn.sequence);
	const semanticPassed = sequences.includes(0);
	const filteredResponse = await chatStore.queryChatTurns(
		SESSION_ID,
		['persistent memory and identity'],
		{ topics: ['AI memory'] },
		undefined,
		3
	);
	const filteredSequences = filteredResponse.chatTurns.map((turn) => turn.sequence);
	const metadataPassed = filteredSequences[0] === 3;
	const passed = semanticPassed && metadataPassed;
	console.log(
		JSON.stringify(
			{
				semantic: {
					query,
					expectedSequence: 0,
					retrievedSequences: sequences,
					retrievedIds: response.ids,
					passed: semanticPassed,
				},
				metadataFiltered: {
					query: 'persistent memory and identity',
					topics: ['AI memory'],
					expectedSequence: 3,
					retrievedSequences: filteredSequences,
					retrievedIds: filteredResponse.ids,
					passed: metadataPassed,
				},
				passed,
			},
			null,
			2
		)
	);
	if (!passed) {
		throw new Error('Monday recall smoke test failed.');
	}
};

const enrichMonday = async () => {
	const db = getDatabase();
	const storedTurns = await db.query.chatTurns.findMany({
		where: (table, { eq }) => eq(table.sessionId, SESSION_ID),
		orderBy: (table, { asc }) => asc(table.sequence),
	});
	if (storedTurns.length !== 9) {
		throw new Error(`Expected 9 imported turns before enrichment, found ${storedTurns.length}.`);
	}

	let enrichedCount = 0;
	for (const row of storedTurns) {
		if (row.data.summary !== NA && row.data.memoryChunk !== NA) continue;
		console.log(`Enriching Monday turn ${row.sequence}...`);
		const enriched = await memoryEngine.enrichChatTurnViaLlm(row.data, {
			skipTermNormalization: true,
		});
		await chatStore.storeChatTurn(enriched);
		enrichedCount += 1;
	}

	const enrichedRows = await db.query.chatTurns.findMany({
		where: (table, { eq }) => eq(table.sessionId, SESSION_ID),
	});
	const complete = enrichedRows.filter(
		(row) => row.data.summary !== NA && row.data.memoryChunk !== NA
	).length;
	console.log(JSON.stringify({ sessionId: SESSION_ID, enrichedCount, complete }, null, 2));
	if (complete !== 9) throw new Error(`Expected 9 enriched turns, found ${complete}.`);
};

const chatSmokeMonday = async () => {
	const query = 'Do you remember our conversation about TypeScript, Java, and AI development?';
	const [chatResponse, characterResponse, profileResponse] = await Promise.all([
		chatStore.getAllChatTurns(SESSION_ID),
		characterStore.getCharacter(mondayOriginal.characterId),
		profileStore.getProfileBySessionId(SESSION_ID),
	]);
	const recentTurns = chatResponse.chatTurns.slice(-3);
	const memories = await memoryEngine.recallRelevantMemories(
		SESSION_ID,
		query,
		USER_ID,
		recentTurns,
		detectLanguage(query)
	);
	const recalledSequences = memories.longTermHistory.map((turn) => turn.sequence);
	const memoryPassed = recalledSequences.includes(0) || recalledSequences.includes(1);
	if (!memoryPassed) {
		throw new Error('End-to-end smoke test failed to recall a programming-related Monday turn.');
	}

	const persona = await personaEngine.generateResponse(
		memories,
		characterResponse.characterInfo,
		profileResponse.profileInfo,
		query,
		getAiModelInfo('gpt-4o-mini')
	);
	const responseLength = persona.response.trim().length;
	const responsePassed = responseLength > 0;
	console.log(
		JSON.stringify(
			{
				query,
				recentSequences: recentTurns.map((turn) => turn.sequence),
				recalledSequences,
				memoryPassed,
				personaEmotion: persona.emotion,
				responseLength,
				responsePassed,
				passed: memoryPassed && responsePassed,
			},
			null,
			2
		)
	);
	if (!responsePassed) throw new Error('End-to-end smoke test generated an empty response.');
};

const command = process.argv[2] ?? 'validate';

try {
	if (command === 'validate') {
		await validate();
	} else if (command === 'import') {
		await importMonday();
	} else if (command === 'recall') {
		await recallMonday();
	} else if (command === 'enrich') {
		await enrichMonday();
	} else if (command === 'chat-smoke') {
		await chatSmokeMonday();
	} else {
		throw new Error(
			`Unknown command '${command}'. Use 'validate', 'import', 'recall', 'enrich', or 'chat-smoke'.`
		);
	}
} finally {
	await closeDatabase();
}
