// src/migration/chat/recapChatBatch.ts

import 'dotenv/config.js'; // <-- ADD THIS AT THE VERY TOP
import { writeFile, access, readFile, mkdir, unlink } from 'fs/promises';
import { ChatTurn, METADATA_TYPES, buildRecapId, parseEntriesToText } from '../../shared/index.js';
import { buildFactualRecapPrompt } from '../../server/util/templateUtils.js';
import { chatStore } from '#server/index.js';
import { chromaDbClient } from '#server/db/index.js';

// --- Configuration ---
const TARGET_SESSION_ID = process.argv[2];
if (!TARGET_SESSION_ID) {
	console.error('Usage: bun recapChatBatch.ts <session_id>');
	process.exit(1);
}
const OUTPUT_DIR = './src/migration/recap/output';
const PROGRESS_DIR = './src/migration/recap/progress'; // Separate dir for progress files
const BATCH_SIZE = 3;

const DEEPSEEK_MODEL = 'deepseek/deepseek-v3-0324:free';
const DEEPSEEK_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_MODEL = 'llama3-70b-8192';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- Progress State Type ---
interface ProgressState {
	lastSuccessfulBatchIndex: number;
	recapTexts: string[];
}

// --- Helper & LLM functions (identical, no changes needed) ---
const getSessionChatTurns = async (sessionId: string): Promise<ChatTurn[]> => {
	const chatRes = await chatStore.getAllChatTurns(sessionId);
	return chatRes.chatTurns.sort((a, b) => a.sequence - b.sequence);
};

const createBatches = <T>(items: T[], batchSize: number): T[][] => {
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		batches.push(items.slice(i, i + batchSize));
	}
	return batches;
};

const callDeepseek = async (prompt: string): Promise<string> => {
	const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: DEEPSEEK_MODEL,
			messages: [{ role: 'system', content: prompt }],
			max_tokens: 1536,
			temperature: 0.3,
		}),
	});
	if (res.status === 429) throw new Error('RATE_LIMIT');
	if (!res.ok) throw new Error(`[DS] ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json?.choices?.[0]?.message?.content;
	if (!content) throw new Error(`[DS] Empty response`);
	return content.trim();
};

const callGroq = async (prompt: string): Promise<string> => {
	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
		body: JSON.stringify({
			model: GROQ_MODEL,
			messages: [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: prompt },
			],
			temperature: 0.3,
			max_tokens: 1536,
		}),
	});
	if (res.status === 429) throw new Error('RATE_LIMIT');
	if (!res.ok) throw new Error(`[Groq] ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json?.choices?.[0]?.message?.content;
	if (!content) throw new Error(`[Groq] Empty content`);
	return content.trim();
};

const callLLMWithFallback = async (prompt: string): Promise<string> => {
	try {
		return await callDeepseek(prompt);
	} catch (e) {
		if (e instanceof Error && e.message === 'RATE_LIMIT') {
			console.warn('  ⚠️ Deepseek rate limited, falling back to Groq...');
			return callGroq(prompt);
		}
		throw e; // Fail fast if other error
	}
};

// --- Main logic with Resumability ---
const main = async () => {
	// 1. Setup paths and load progress
	const progressFilePath = `${PROGRESS_DIR}/${TARGET_SESSION_ID}_factual_progress.json`;
	let recapTexts: string[] = [];
	let startBatchIndex = 0;

	try {
		await mkdir(PROGRESS_DIR, { recursive: true });
		const progressData = await readFile(progressFilePath, 'utf-8');
		const progress: ProgressState = JSON.parse(progressData);
		recapTexts = progress.recapTexts || [];
		startBatchIndex = progress.lastSuccessfulBatchIndex + 1;
		console.log(`✅ Progress file found. Resuming from batch ${startBatchIndex + 1}.`);
	} catch (error) {
		console.log('📋 No progress file found. Starting from scratch.');
	}

	const chatTurns = await getSessionChatTurns(TARGET_SESSION_ID);
	if (!chatTurns.length) throw new Error('No chat turns found for session.');
	const userName = chatTurns[0].request.showName;
	const charName = chatTurns[0].response.showName;
	console.log(
		`Loaded ${chatTurns.length} turns for session ${TARGET_SESSION_ID}: ${userName} vs ${charName}`
	);

	const batches = createBatches(chatTurns, BATCH_SIZE);

	// 2. Main processing loop, starting from the last successful point
	for (let batchIdx = startBatchIndex; batchIdx < batches.length; ++batchIdx) {
		const batch = batches[batchIdx];
		const turnsText = batch
			.map((turn) => {
				const userMsg = parseEntriesToText(turn.request.entries);
				const charMsg = parseEntriesToText(turn.response.entries);
				return `[Turn ${turn.sequence}]\n${userName}: "${userMsg}"\n${charName}: "${charMsg}"`;
			})
			.join('\n\n');

		const availableKeywords = [...new Set(batch.flatMap((turn) => turn.keywords))];
		const availableTopics = [...new Set(batch.flatMap((turn) => turn.topics))];
		const availableEntities = [...new Set(batch.flatMap((turn) => turn.entities))];

		const prompt = buildFactualRecapPrompt(
			userName,
			charName,
			'female',
			'male',
			turnsText,
			availableKeywords,
			availableTopics,
			availableEntities
		);

		try {
			console.log(
				`Recapping batch ${batchIdx + 1}/${batches.length} [turns ${batch[0].sequence}~${
					batch[batch.length - 1].sequence
				}]`
			);
			const recap = await callLLMWithFallback(prompt);
			console.log(`  - Recap generated successfully.`);

			const recapId = buildRecapId(
				TARGET_SESSION_ID,
				batchIdx + 1,
				batch[batch.length - 1]?.sequence ?? 0
			);
			recapTexts.push(`# Recap batch ${batchIdx + 1} (recapId=${recapId})\n\n${recap}\n\n---\n`);

			// 3. Save progress immediately after a successful batch
			const currentProgress: ProgressState = {
				lastSuccessfulBatchIndex: batchIdx,
				recapTexts: recapTexts,
			};
			await writeFile(progressFilePath, JSON.stringify(currentProgress, null, 2));
			console.log(`  - Progress saved for batch ${batchIdx + 1}.`);
		} catch (e) {
			console.error(`❌ Failed batch ${batchIdx + 1}:`, e);
			console.log(`\n🛑 Process stopping. Run script again to resume from this point.`);
			process.exit(1); // Exit gracefully so the user knows to restart
		}
	}

	// 4. Finalization after the loop completes
	console.log('\n🎉 All batches processed successfully!');

	await mkdir(OUTPUT_DIR, { recursive: true });
	const outPath = `${OUTPUT_DIR}/${TARGET_SESSION_ID}_all_factual_recaps.md`;
	const finalContent = `# Factual Recaps for session: ${TARGET_SESSION_ID}\n\n${recapTexts.join('\n')}`;
	await writeFile(outPath, finalContent);
	console.log(`Final factual recap file saved to: ${outPath}`);

	const recapDocId = buildRecapId(TARGET_SESSION_ID, 0, 0);
	const recapCollection = await chromaDbClient.getRecapCollection();
	await recapCollection.upsert({
		ids: [recapDocId],
		documents: [finalContent],
		metadatas: [{ sessionId: TARGET_SESSION_ID, type: METADATA_TYPES.RECAP }],
	});
	console.log(`Final factual recaps upserted to ChromaDB with id: ${recapDocId}`);

	// 5. Clean up the progress file
	try {
		await unlink(progressFilePath);
		console.log('✅ Temporary progress file cleaned up.');
	} catch (e) {
		console.warn('⚠️ Could not clean up progress file, you can delete it manually.');
	}
};

main().catch((e) => {
	console.error('Fatal error in factual recap generation:', e);
	process.exit(1);
});
