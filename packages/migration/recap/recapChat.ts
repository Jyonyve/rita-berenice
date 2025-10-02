// src/migration/chat/recapChatBatch.ts

import { chromaDbClient } from '@rita-berenice/server/db';
import { chatStore } from '@rita-berenice/server/store';
import { buildFactualRecapPrompt } from '@rita-berenice/server/util';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ChatTurn, RecapInfo } from '@rita-berenice/shared/domain';
import { buildRecapId, recapToMetadata } from '@rita-berenice/shared/util';
import { writeFile, access, readFile, mkdir, unlink } from 'fs/promises';

// --- Configuration (Same) ---
const TARGET_SESSION_ID = process.argv[2];
if (!TARGET_SESSION_ID) {
	console.error('Usage: pnpm recap:factual -- <session_id>');
	process.exit(1);
}

const BATCH_SIZE = 3;

const GEMINI_MODEL = 'gemini-2.0-flash-001'; // Fast model for metadata extraction
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const DEEPSEEK_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_MODEL = 'llama3-70b-8192';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- Progress State Type (Same) ---
interface ProgressState {
	lastSuccessfulBatchIndex: number;
	recapTexts: string[];
}

// --- Helper & LLM functions (Same) ---
const extractJsonFromMarkdown = (response: string): any => {
	let cleaned = response.trim();
	try {
		const codeBlockMatch = cleaned.match(/``````/i);
		if (codeBlockMatch && codeBlockMatch[1]) {
			return JSON.parse(codeBlockMatch[1]);
		}
		const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
		if (jsonMatch && jsonMatch[1]) {
			return JSON.parse(jsonMatch[1]);
		}
		if (!cleaned.startsWith('{') && cleaned.includes('{') && cleaned.includes('}')) {
			const firstBrace = cleaned.indexOf('{');
			const lastBrace = cleaned.lastIndexOf('}');
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				cleaned = cleaned.substring(firstBrace, lastBrace + 1);
			}
		}
		return JSON.parse(cleaned);
	} catch (error) {
		console.error('JSON extraction failed. Raw text snippet:', cleaned.substring(0, 500));
		return {};
	}
};

const getSessionChatTurns = async (sessionId: string): Promise<ChatTurn[]> => {
	const chatRes = await chatStore.getAllChatTurns(sessionId);
	return chatRes.displayTurns.sort((a, b) => a.sequence - b.sequence);
};
const createBatches = <T>(items: T[], batchSize: number): T[][] => {
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		batches.push(items.slice(i, i + batchSize));
	}
	return batches;
};
// --- LLM API Call Functions ---

const callGemini = async (prompt: string): Promise<string> => {
	if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');
	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.3,
					maxOutputTokens: 2048,
					response_mime_type: 'application/json',
				},
			}),
		}
	);
	if (res.status === 429) throw new Error('RATE_LIMIT');
	if (!res.ok) throw new Error(`[Gemini] ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!content) throw new Error(`[Gemini] Empty response`);
	return content.trim();
};

const callGroq = async (prompt: string, attempt = 1): Promise<string> => {
	if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
		body: JSON.stringify({
			model: GROQ_MODEL,
			messages: [
				// ✅ FIX: Added explicit instruction for JSON output.
				{
					role: 'system',
					content: 'You are a helpful assistant. Please provide the output in valid JSON format.',
				},
				{ role: 'user', content: prompt },
			],
			temperature: 0.3,
			max_tokens: 2048,
			response_format: { type: 'json_object' },
		}),
	});
	if (res.status === 429) {
		const errorJson = await res.json();
		const match = errorJson?.error?.message?.match(/try again in ([\d.]+)s/i);
		const waitMs = match ? parseFloat(match[1]) * 1000 : 25000;

		console.warn(`    ⏳ Groq rate limited. Waiting ${waitMs / 1000}s before retrying...`);

		if (attempt >= 2) throw new Error(`Groq API rate limit (429) after retry.`);

		await new Promise((resolve) => setTimeout(resolve, waitMs));
		return callGroq(prompt, attempt + 1); // retry once
	}
	if (!res.ok) throw new Error(`[Groq] ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json?.choices?.[0]?.message?.content;
	if (!content) throw new Error(`[Groq] Empty content`);
	return content.trim();
};

const callDeepseek = async (prompt: string): Promise<string> => {
	if (!DEEPSEEK_API_KEY) throw new Error('OPENROUTER_API_KEY is not set.');
	const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: DEEPSEEK_MODEL,
			messages: [{ role: 'system', content: prompt }],
			max_tokens: 2048,
			temperature: 0.3,
			response_format: { type: 'json_object' },
		}),
	});
	if (res.status === 429) throw new Error('RATE_LIMIT');
	if (!res.ok) throw new Error(`[Deepseek] ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json?.choices?.[0]?.message?.content;
	if (!content) throw new Error(`[Deepseek] Empty response`);
	return content.trim();
};

/**
 * Calls LLMs in a specific order (Gemini -> Groq -> Deepseek) with fallbacks.
 * @returns An object containing the response string and the name of the model that succeeded.
 */
const callLLMWithFallback = async (
	prompt: string
): Promise<{ response: string; model: string }> => {
	try {
		console.log('  - Attempting to call Gemini...');
		const response = await callGemini(prompt);
		return { response, model: GEMINI_MODEL };
	} catch (e) {
		console.warn('  ⚠️ Gemini failed, falling back to Groq...', e instanceof Error ? e.message : '');
		try {
			console.log('  - Attempting to call Groq...');
			const response = await callGroq(prompt);
			return { response, model: GROQ_MODEL };
		} catch (e2) {
			console.warn(
				'  ⚠️ Groq failed, falling back to Deepseek...',
				e2 instanceof Error ? e2.message : ''
			);
			try {
				console.log('  - Attempting to call Deepseek...');
				const response = await callDeepseek(prompt);
				return { response, model: DEEPSEEK_MODEL };
			} catch (e3) {
				console.error('  ❌ All LLM providers failed.');
				throw e3;
			}
		}
	}
};

// --- Main logic with Individual DB Inserts ---
const main = async () => {
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
	const firstTurn = chatTurns[0];
	console.log(
		`Loaded ${chatTurns.length} turns for session ${TARGET_SESSION_ID}: ${userName} vs ${charName}`
	);

	const batches = createBatches(chatTurns, BATCH_SIZE);
	const recapCollection = await chromaDbClient.getRecapCollection();

	for (let batchIdx = startBatchIndex; batchIdx < 0; ++batchIdx) {
		const batch = batches[batchIdx];
		const firstBatchTurn = batch[0];
		const lastBatchTurn = batch[batch.length - 1];

		const turnsText = batch
			.map((turn) => {
				const userMsg = parseEntriesToText(turn.request.entries);
				const charMsg = parseEntriesToText(turn.response.entries);
				return `[Turn ${turn.sequence}, CreatedAt: ${turn.createdAt}]\n${userName}: "${userMsg}"\n${charName}: "${charMsg}"`;
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
			console.log(`Recapping batch ${batchIdx + 1}/${batches.length}...`);
			const { response: llmResponseJsonString, model: successfulModel } =
				await callLLMWithFallback(prompt);

			console.log(`  - LLM response received from ${successfulModel}.`);

			const parsedRecap = extractJsonFromMarkdown(llmResponseJsonString);
			const recapId = buildRecapId(TARGET_SESSION_ID, firstBatchTurn.sequence, lastBatchTurn.sequence);

			const recapInfo: RecapInfo = {
				recapId,
				sessionId: TARGET_SESSION_ID,
				characterId: firstTurn.characterId,
				userId: firstTurn.userId,
				profileId: firstTurn.profileId,
				type: METADATA_TYPES.RECAP,
				turnStart: firstBatchTurn.sequence,
				turnEnd: lastBatchTurn.sequence,
				model: successfulModel, // Or enhance logic to track fallback model
				content: parsedRecap.content || '',
				keywords: parsedRecap.keywords?.join(',') || '',
				topics: parsedRecap.topics?.join(',') || '',
				entities: parsedRecap.entities?.join(',') || '',
				flagsArray: parsedRecap.flags || [],
				loreReferenceListArray: parsedRecap.loreReferenceList || [],
				historyReferenceListArray: parsedRecap.historyReferenceList || [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sequence: batchIdx + 1,
			};

			const recapMetadata = recapToMetadata(recapInfo);

			await recapCollection.upsert({
				ids: [recapId],
				documents: [recapInfo.content],
				metadatas: [recapMetadata as any],
			});
			console.log(`  - Upserted recap ${recapId} to DB.`);
			// --- [END NEW] ---

			recapTexts.push(
				`# Recap batch ${batchIdx + 1} (recapId=${recapId})\n\n${recapInfo.content}\n\n---\n`
			);

			const currentProgress: ProgressState = {
				lastSuccessfulBatchIndex: batchIdx,
				recapTexts: recapTexts,
			};
			await writeFile(progressFilePath, JSON.stringify(currentProgress, null, 2));
			console.log(`  - Progress saved for batch ${batchIdx + 1}.`);
		} catch (e) {
			console.error(`❌ Failed batch ${batchIdx + 1}:`, e);
			console.log(`\n🛑 Process stopping. Run script again to resume from this point.`);
			process.exit(1);
		}
	}

	// Finalization (write markdown file, cleanup progress)
	console.log('\n🎉 All batches processed successfully!');

	await mkdir(OUTPUT_DIR, { recursive: true });
	const outPath = `${OUTPUT_DIR}/${TARGET_SESSION_ID}_all_factual_recaps.md`;
	const finalContent = `# Factual Recaps for session: ${TARGET_SESSION_ID}\n\n${recapTexts.join('\n')}`;
	await writeFile(outPath, finalContent);
	console.log(`Final factual recap file saved to: ${outPath}`);

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
