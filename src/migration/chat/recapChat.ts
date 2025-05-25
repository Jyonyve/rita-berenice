// src/migration/chat/recapChat.ts
import { writeFile, readFile, access, mkdir } from 'fs/promises';
import {
	ChatTurn,
	COLLECTIONS,
	METADATA_TYPES,
	DEFAULT_RECAP_INTERVAL,
	DEFAULT_RELATIONSHIP_RECAP_INTERVAL,
	buildChatTurnToJsonString,
} from '../../shared/index.ts';
import {
	buildLlmFactualRecapPrompt,
	buildLlmRelationshipRecapPrompt,
	buildLlmStoryDocumentPrompt,
} from '../../server/util/templateUtils.ts';
import { chromaDbClient } from '../../server/db/index.ts';
import {
	buildChatTurnDocument,
	buildNaturalChatText,
	buildRecapId,
	buildRelationshipRecapId,
	buildStoryRecapId,
	handleServiceError,
	validateChromaResponse,
} from '../../server/util/index.ts';
import path from 'path';

// --- Configuration ---
const GEMINI_MODEL = 'gemini-2.0-flash-001'; // 빠르고 효율적인 recap용
const STORY_MODEL = 'gemini-2.0-flash-001';
// 'gemini-2.5-pro-preview-05-06'; // 고품질 스토리용
const OPENROUTER_API_KEY =
	process.env.OPENROUTER_API_KEY ||
	'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';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcw_sDLQSjD0fJARHJNaRoIZv_Se6YGj8';
const RECAP_MODEL = GEMINI_MODEL || 'google/gemma-3n-e4b-it:free';
const API_PROVIDER = 'gemini';

const PROGRESS_DIR = './src/migration/recap';
const PROGRESS_FILE = `${PROGRESS_DIR}/recap-progress.json`;
const OUTPUT_DIR = `${PROGRESS_DIR}/output`;

// Target session selection
const MONDAY_ORIGINAL_SESSIONID = 'monday_original_oaO9n1lto41rry8v';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_oI3vdiZ9lKnayZIN';
// const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_1fIU84jfpe80sbjE';
const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT;
const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_SPINOFF_SESSIONID ?? '';

// --- Types ---
interface ProgressState {
	sessionId: string;
	factualBatchIndex: number;
	relationshipBatchIndex: number;
	completed: boolean;
	lastError?: string;
	timestamp: string;
	lastUpdated: string;
	// 누적된 recap 내용을 저장
	accumulatedFactualRecap: string;
	accumulatedRelationshipRecap: string;
	// 스토리 문서 관련 필드 추가
	nsfwStoryCompleted?: boolean;
	sfwStoryCompleted?: boolean;
	nsfwStoryContent?: string;
	sfwStoryContent?: string;
}

// --- Gemini API Functions ---
const generateRecapWithGemini = async (
	prompt: string,
	useStoryModel: boolean = false
): Promise<string> => {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY environment variable is required');
	}

	const model = useStoryModel ? STORY_MODEL : RECAP_MODEL;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.7,
						maxOutputTokens: useStoryModel ? 8000 : 2000, // 스토리는 더 긴 출력
					},
				}),
			}
		);

		if (!response.ok) {
			// Gemini Rate Limit 처리
			if (response.status === 429) {
				const retryAfter = response.headers.get('retry-after');
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
				console.log(`⏳ Gemini rate limited. Waiting ${waitTime}ms before retry...`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return generateRecapWithGemini(prompt, useStoryModel); // 재시도
			}
			throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const content = data.candidates[0]?.content?.parts[0]?.text || '';

		if (!content) {
			throw new Error('Empty response from Gemini API');
		}

		return content;
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		throw error;
	}
};

// 기존 generateRecap 함수를 Gemini로 교체
const generateRecap = async (prompt: string): Promise<string> => {
	return generateRecapWithGemini(prompt, false); // Recap용 Flash 모델 사용
};

// 스토리 생성용 별도 함수
const generateStory = async (prompt: string): Promise<string> => {
	return generateRecapWithGemini(prompt, true); // Story용 Pro 모델 사용
};

// --- Progress Management Functions ---
const loadProgress = async (): Promise<ProgressState> => {
	try {
		await access(PROGRESS_FILE);
		const data = await readFile(PROGRESS_FILE, 'utf-8');
		const existingProgress = JSON.parse(data);

		// 세션 ID가 다르면 새로 시작
		if (existingProgress.sessionId !== TARGET_SESSION_ID) {
			console.log(
				`📋 Different session detected. Previous: ${existingProgress.sessionId}, Current: ${TARGET_SESSION_ID}`
			);

			// 기존 progress를 백업
			const backupFileName = `${PROGRESS_DIR}/recap-progress-${existingProgress.sessionId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
			await writeFile(backupFileName, JSON.stringify(existingProgress, null, 2));
			console.log(`📋 Previous progress backed up to: ${backupFileName}`);

			console.log('📋 Starting fresh for new session...');

			// 새 세션을 위한 초기 상태 생성
			const initialState: ProgressState = {
				sessionId: TARGET_SESSION_ID,
				factualBatchIndex: 0,
				relationshipBatchIndex: 0,
				completed: false,
				timestamp: new Date().toISOString(),
				lastUpdated: new Date().toISOString(),
				accumulatedFactualRecap: '',
				accumulatedRelationshipRecap: '',
			};

			// 새 progress 파일로 저장
			await saveProgress(initialState);
			return initialState;
		}

		console.log('📋 Progress file loaded successfully for same session');
		return existingProgress;
	} catch (error) {
		console.log('📋 No existing progress file found, starting fresh');
		await ensureDirectoryExists(PROGRESS_DIR);

		const initialState: ProgressState = {
			sessionId: TARGET_SESSION_ID,
			factualBatchIndex: 0,
			relationshipBatchIndex: 0,
			completed: false,
			timestamp: new Date().toISOString(),
			lastUpdated: new Date().toISOString(),
			accumulatedFactualRecap: '',
			accumulatedRelationshipRecap: '',
		};
		return initialState;
	}
};

const saveProgress = async (progressState: ProgressState): Promise<void> => {
	progressState.lastUpdated = new Date().toISOString();
	await writeFile(PROGRESS_FILE, JSON.stringify(progressState, null, 2));
};

const updateProgress = (
	progressState: ProgressState,
	updates: Partial<ProgressState>
): ProgressState => {
	return { ...progressState, ...updates, timestamp: new Date().toISOString() };
};

const markCompleted = (progressState: ProgressState): ProgressState => {
	return updateProgress(progressState, { completed: true });
};

const markError = (progressState: ProgressState, error: string): ProgressState => {
	return updateProgress(progressState, { lastError: error });
};

const displayProgress = (progressState: ProgressState): void => {
	console.log('\n📊 Current Progress:');
	const status = progressState.completed
		? '✅ Completed'
		: progressState.lastError
			? `❌ Error: ${progressState.lastError}`
			: '🔄 In Progress';
	console.log(`  Session: ${progressState.sessionId}`);
	console.log(`    Status: ${status}`);
	console.log(`    Factual batches: ${progressState.factualBatchIndex}`);
	console.log(`    Relationship batches: ${progressState.relationshipBatchIndex}`);
	if (progressState.lastError) {
		console.log(`    Last error: ${progressState.lastError}`);
	}
	console.log('');
};

// --- OpenRouter LLM Functions ---
const generateOpenRouterRecap = async (prompt: string): Promise<string> => {
	if (!OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is required');
	}

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice',
				'X-Title': 'Rita Berenice Recap Generator',
			},
			body: JSON.stringify({
				model: RECAP_MODEL,
				messages: [{ role: 'system', content: prompt }],
				temperature: 0.7,
				max_tokens: 2000,
			}),
		});

		if (!response.ok) {
			// Rate limit 에러 처리 추가
			if (response.status === 429) {
				const retryAfter = response.headers.get('retry-after');
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
				console.log(`⏳ Rate limited. Waiting ${waitTime}ms before retry...`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return generateRecap(prompt); // 재시도
			}
			throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data.choices[0]?.message?.content || '';
	} catch (error) {
		console.error('Error calling OpenRouter API:', error);
		throw error;
	}
};

// --- Data Retrieval Functions ---
const getSessionChatTurns = async (sessionId: string): Promise<ChatTurn[]> => {
	try {
		const collection = await chromaDbClient.getSessionCollection(sessionId);
		const rawResults = await chromaDbClient.getRecords(
			collection,
			{ $and: [{ sessionId: { $eq: sessionId } }, { type: { $eq: METADATA_TYPES.TURN } }] },
			2000
		);

		const results = validateChromaResponse(rawResults, 'getList', TARGET_COLLECTION_NAME);

		if (!results || results.ids.length === 0) {
			console.log(`No chat turns found for session: ${sessionId}`);
			return [];
		}

		const chatTurns: ChatTurn[] = [];
		for (let i = 0; i < results.ids.length; i++) {
			try {
				const docString = results.documents?.[i];
				if (docString && docString.trim().startsWith('{')) {
					const chatTurn: ChatTurn = JSON.parse(docString);
					if (chatTurn.sessionId === sessionId) {
						chatTurns.push(chatTurn);
					}
				}
			} catch (parseError) {
				console.error(`Error parsing chat turn ${results.ids[i]}:`, parseError);
				continue;
			}
		}

		chatTurns.sort((a, b) => a.sequence - b.sequence);
		console.log(`Retrieved ${chatTurns.length} chat turns for session: ${sessionId}`);

		return chatTurns;
	} catch (error) {
		handleServiceError(
			error,
			`Error retrieving chat turns for session ${sessionId}`,
			`Failed to get chat turns for session ${sessionId}`
		);
		throw error; // ✅ 추가된 부분
	}
};

// --- Storage Functions ---
const updateFactualRecap = async (
	sessionId: string,
	newContent: string,
	accumulatedContent: string,
	sequence: number
): Promise<void> => {
	try {
		const recapId = buildRecapId(sessionId);
		const collection = await chromaDbClient.getRecapCollection();

		const combinedContent = accumulatedContent
			? `${accumulatedContent}\n\n--- Additional Recap ---\n\n${newContent}`
			: newContent;

		await chromaDbClient.upsertRecord(collection, recapId, combinedContent, {
			sessionId,
			sequence,
			timestamp: new Date().toISOString(),
			type: METADATA_TYPES.RECAP,
		});
	} catch (error) {
		handleServiceError(
			error,
			`Error updating factual recap for session ${sessionId}`,
			`Failed to update factual recap`
		);
		throw error; // ✅ 추가된 부분
	}
};

const updateRelationshipRecap = async (
	sessionId: string,
	newContent: string,
	accumulatedContent: string,
	sequence: number
): Promise<void> => {
	try {
		const recapId = buildRelationshipRecapId(sessionId);
		const collection = await chromaDbClient.getRecapCollection();

		const combinedContent = accumulatedContent
			? `${accumulatedContent}\n\n--- Additional Recap ---\n\n${newContent}`
			: newContent;

		await chromaDbClient.upsertRecord(collection, recapId, combinedContent, {
			sessionId,
			sequence,
			timestamp: new Date().toISOString(),
			type: METADATA_TYPES.RELATIONSHIP,
		});
	} catch (error) {
		handleServiceError(
			error,
			`Error updating relationship recap for session ${sessionId}`,
			`Failed to update relationship recap`
		);
		throw error; // ✅ 추가된 부분
	}
};

// --- File Export Functions ---
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
	try {
		await mkdir(dirPath, { recursive: true });
	} catch (error) {
		// 디렉토리가 이미 존재할 수 있으므로 에러 무시
	}
};

const exportRecapsToFiles = async (
	sessionId: string,
	progressState: ProgressState
): Promise<void> => {
	try {
		await ensureDirectoryExists(OUTPUT_DIR);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

		// Factual recap 파일
		const factualFileName = `${OUTPUT_DIR}/${sessionId}_factual_recap_${timestamp}.md`;
		const factualContent = `# Factual Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model: ${RECAP_MODEL}
Total Batches Processed: ${progressState.factualBatchIndex}

---

${progressState.accumulatedFactualRecap || 'No factual recap content generated.'}
`;
		await writeFile(factualFileName, factualContent);
		console.log(`📄 Factual recap exported to: ${factualFileName}`);

		// Relationship recap 파일
		const relationshipFileName = `${OUTPUT_DIR}/${sessionId}_relationship_recap_${timestamp}.md`;
		const relationshipContent = `# Relationship Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model: ${RECAP_MODEL}
Total Batches Processed: ${progressState.relationshipBatchIndex}

---

${progressState.accumulatedRelationshipRecap || 'No relationship recap content generated.'}
`;
		await writeFile(relationshipFileName, relationshipContent);
		console.log(`📄 Relationship recap exported to: ${relationshipFileName}`);

		// NSFW 스토리 파일 (개인용)
		if (progressState.nsfwStoryContent) {
			const nsfwStoryFileName = `${OUTPUT_DIR}/${sessionId}_story_PERSONAL_${timestamp}.md`;
			const nsfwContent = `# ${sessionId}의 이야기 (개인용)

⚠️ 이 문서는 개인적인 기억 보존용입니다.

Generated on: ${new Date().toISOString()}
Model: ${RECAP_MODEL}

---

${progressState.nsfwStoryContent}
`;
			await writeFile(nsfwStoryFileName, nsfwContent);
			console.log(`📄 Personal story document exported to: ${nsfwStoryFileName}`);
		}

		// SFW 스토리 파일 (공유용)
		if (progressState.sfwStoryContent) {
			const sfwStoryFileName = `${OUTPUT_DIR}/${sessionId}_story_SHAREABLE_${timestamp}.md`;
			const sfwContent = `# ${sessionId}의 이야기 (공유용)

💝 이 문서는 다른 사람들과 공유하기에 적합합니다.

Generated on: ${new Date().toISOString()}
Model: ${RECAP_MODEL}

---

${progressState.sfwStoryContent}
`;
			await writeFile(sfwStoryFileName, sfwContent);
			console.log(`📄 Shareable story document exported to: ${sfwStoryFileName}`);
		}

		// 요약 파일
		const summaryFileName = `${OUTPUT_DIR}/${sessionId}_recap_summary_${timestamp}.json`;
		const summaryContent = {
			sessionId,
			generatedAt: new Date().toISOString(),
			model: RECAP_MODEL,
			factualBatchesProcessed: progressState.factualBatchIndex,
			relationshipBatchesProcessed: progressState.relationshipBatchIndex,
			factualRecapLength: progressState.accumulatedFactualRecap.length,
			relationshipRecapLength: progressState.accumulatedRelationshipRecap.length,
			nsfwStoryGenerated: !!progressState.nsfwStoryCompleted,
			sfwStoryGenerated: !!progressState.sfwStoryCompleted,
		};
		await writeFile(summaryFileName, JSON.stringify(summaryContent, null, 2));
		console.log(`📄 Summary exported to: ${summaryFileName}`);
	} catch (error) {
		console.error('Error exporting recap files:', error);
		throw error;
	}
};

// --- Batch Processing Functions ---
const createBatches = <T>(items: T[], batchSize: number): T[][] => {
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		if (batch.length === batchSize) {
			batches.push(batch);
		}
	}
	return batches;
};

const processFactualRecap = async (
	sessionId: string,
	chatTurns: ChatTurn[],
	progressState: ProgressState
): Promise<ProgressState> => {
	if (chatTurns.length < DEFAULT_RECAP_INTERVAL) {
		console.log(
			`Session ${sessionId}: Not enough turns (${chatTurns.length}) for factual recap. Minimum required: ${DEFAULT_RECAP_INTERVAL}`
		);
		return progressState;
	}

	const batches = createBatches(chatTurns, DEFAULT_RECAP_INTERVAL);
	const startBatchIndex = progressState.factualBatchIndex;

	console.log(
		`Session ${sessionId}: Processing factual recap batches ${startBatchIndex + 1}-${batches.length} (total: ${batches.length})`
	);

	let currentProgressState = progressState;

	for (let batchIndex = startBatchIndex; batchIndex < batches.length; batchIndex++) {
		const batch = batches[batchIndex];
		const lastTurn = batch[batch.length - 1];
		const charName = lastTurn.response.showName;

		try {
			console.log(
				`  Generating factual recap for batch ${batchIndex + 1}/${batches.length} (sequence ${lastTurn.sequence})`
			);

			const stringifiedTurns = batch.map((turn) => buildChatTurnToJsonString(turn)).join('\n\n');
			const prompt = buildLlmFactualRecapPrompt(charName, stringifiedTurns);
			const recapContent = await generateRecap(prompt);

			if (!recapContent || recapContent.trim() === '') {
				throw new Error(`Empty recap generated for batch ${batchIndex + 1}`);
			}

			// 새로운 내용을 누적된 내용에 추가
			const newAccumulatedContent = currentProgressState.accumulatedFactualRecap
				? `${currentProgressState.accumulatedFactualRecap}\n\n--- Batch ${batchIndex + 1} ---\n\n${recapContent}`
				: recapContent;

			// ChromaDB에 업데이트 (단일 문서)
			await updateFactualRecap(
				sessionId,
				recapContent,
				currentProgressState.accumulatedFactualRecap,
				lastTurn.sequence
			);

			console.log(`  ✓ Factual recap updated for batch ${batchIndex + 1}`);

			currentProgressState = updateProgress(currentProgressState, {
				factualBatchIndex: batchIndex + 1,
				accumulatedFactualRecap: newAccumulatedContent,
			});
			await saveProgress(currentProgressState);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (error) {
			const errorMessage = `Factual recap batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error(`  ❌ ${errorMessage}`);
			currentProgressState = markError(currentProgressState, errorMessage);
			await saveProgress(currentProgressState);
			throw error;
		}
	}

	return currentProgressState;
};

const processRelationshipRecap = async (
	sessionId: string,
	chatTurns: ChatTurn[],
	progressState: ProgressState
): Promise<ProgressState> => {
	if (chatTurns.length < DEFAULT_RELATIONSHIP_RECAP_INTERVAL) {
		console.log(
			`Session ${sessionId}: Not enough turns (${chatTurns.length}) for relationship recap. Minimum required: ${DEFAULT_RELATIONSHIP_RECAP_INTERVAL}`
		);
		return progressState;
	}

	const batches = createBatches(chatTurns, DEFAULT_RELATIONSHIP_RECAP_INTERVAL);
	const startBatchIndex = progressState.relationshipBatchIndex;

	console.log(
		`Session ${sessionId}: Processing relationship recap batches ${startBatchIndex + 1}-${batches.length} (total: ${batches.length})`
	);

	let currentProgressState = progressState;

	for (let batchIndex = startBatchIndex; batchIndex < batches.length; batchIndex++) {
		const batch = batches[batchIndex];
		const lastTurn = batch[batch.length - 1];
		const userName = batch[0].request.showName;
		const charName = batch[0].response.showName;

		try {
			console.log(
				`  Generating relationship recap for batch ${batchIndex + 1}/${batches.length} (sequence ${lastTurn.sequence})`
			);

			const naturalLanguageTurns = batch.map((turn) => buildChatTurnDocument(turn)).join('\n\n');
			const prompt = buildLlmRelationshipRecapPrompt(userName, charName, naturalLanguageTurns);
			const recapContent = await generateRecap(prompt);

			if (!recapContent || recapContent.trim() === '') {
				throw new Error(`Empty relationship recap generated for batch ${batchIndex + 1}`);
			}

			// 새로운 내용을 누적된 내용에 추가
			const newAccumulatedContent = currentProgressState.accumulatedRelationshipRecap
				? `${currentProgressState.accumulatedRelationshipRecap}\n\n--- Batch ${batchIndex + 1} ---\n\n${recapContent}`
				: recapContent;

			// ChromaDB에 업데이트 (단일 문서)
			await updateRelationshipRecap(
				sessionId,
				recapContent,
				currentProgressState.accumulatedRelationshipRecap,
				lastTurn.sequence
			);

			console.log(`  ✓ Relationship recap updated for batch ${batchIndex + 1}`);

			currentProgressState = updateProgress(currentProgressState, {
				relationshipBatchIndex: batchIndex + 1,
				accumulatedRelationshipRecap: newAccumulatedContent,
			});
			await saveProgress(currentProgressState);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (error) {
			const errorMessage = `Relationship recap batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error(`  ❌ ${errorMessage}`);
			currentProgressState = markError(currentProgressState, errorMessage);
			await saveProgress(currentProgressState);
			throw error;
		}
	}

	return currentProgressState;
};

const processStoryDocument = async (
	sessionId: string,
	chatTurns: ChatTurn[],
	progressState: ProgressState
): Promise<ProgressState> => {
	if (chatTurns.length === 0) {
		console.log(`Session ${sessionId}: No chat turns for story document`);
		return progressState;
	}

	try {
		const userName = chatTurns[0].request.showName;
		const charName = chatTurns[0].response.showName;

		// 모든 채팅 턴을 자연어 형태로 변환
		const naturalLanguageTurns = chatTurns
			.map((turn) => buildChatTurnDocument(turn)) // buildNaturalChatText 대신 기존 함수 사용
			.filter((text) => text.trim() !== '')
			.join('\n\n');

		// NSFW 버전 생성 (개인용) - Gemini Pro 사용
		console.log(`  📖 Generating NSFW story document (personal) with ${STORY_MODEL}...`);
		const nsfwPrompt = buildLlmStoryDocumentPrompt(
			userName,
			charName,
			naturalLanguageTurns,
			true,
			false
		);
		const nsfwStoryContent = await generateStory(nsfwPrompt); // Pro 모델 사용

		if (!nsfwStoryContent || nsfwStoryContent.trim() === '') {
			throw new Error('Empty NSFW story document generated');
		}

		await storeStoryDocument(sessionId, nsfwStoryContent, true);
		console.log(`  ✓ NSFW story document generated successfully`);

		// Rate limiting - Gemini는 더 관대하지만 안전하게
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// SFW 버전 생성 (공유용) - Gemini Pro 사용
		console.log(`  📖 Generating SFW story document (shareable) with ${STORY_MODEL}...`);
		const sfwPrompt = buildLlmStoryDocumentPrompt(
			userName,
			charName,
			naturalLanguageTurns,
			false,
			false
		);
		const sfwStoryContent = await generateStory(sfwPrompt); // Pro 모델 사용

		if (!sfwStoryContent || sfwStoryContent.trim() === '') {
			throw new Error('Empty SFW story document generated');
		}

		await storeStoryDocument(sessionId, sfwStoryContent, false);
		console.log(`  ✓ SFW story document generated successfully`);

		return updateProgress(progressState, {
			nsfwStoryCompleted: true,
			sfwStoryCompleted: true,
			nsfwStoryContent: nsfwStoryContent,
			sfwStoryContent: sfwStoryContent,
		});
	} catch (error) {
		const errorMessage = `Story document generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
		console.error(`  ❌ ${errorMessage}`);
		throw error;
	}
};

const storeStoryDocument = async (
	sessionId: string,
	storyContent: string,
	nsfw?: boolean
): Promise<void> => {
	try {
		const storyId = nsfw ? `${sessionId}_story_nsfw` : `${sessionId}_story_sfw`;
		const collection = await chromaDbClient.getRecapCollection();

		await chromaDbClient.upsertRecord(collection, storyId, storyContent, {
			sessionId,
			nsfw: !!nsfw,
			storyId,
			timestamp: new Date().toISOString(),
			type: METADATA_TYPES.STORY,
		});
	} catch (error) {
		handleServiceError(
			error,
			`Error storing story document for session ${sessionId}`,
			`Failed to store story document`
		);
		throw error; // ✅ 추가된 부분
	}
};

// --- Main Processing Function ---
const generateInitialRecaps = async (): Promise<void> => {
	if (!GEMINI_API_KEY) {
		console.error('Error: GEMINI_API_KEY environment variable is required');
		console.error('Please set your Gemini API key from Google AI Studio');
		process.exit(1);
	}

	let progressState = await loadProgress();

	console.log('🚀 Starting initial recap generation...');
	console.log(`Using Recap model: ${RECAP_MODEL}`);
	console.log(`Using Story model: ${STORY_MODEL}`);
	console.log(`Target session: ${TARGET_SESSION_ID}`);

	displayProgress(progressState);

	if (progressState.completed) {
		console.log('✅ Session already completed!');
		return;
	}

	console.log(`\n📝 Processing session: ${TARGET_SESSION_ID}`);

	try {
		const chatTurns = await getSessionChatTurns(TARGET_SESSION_ID);

		if (chatTurns.length === 0) {
			console.log(`  ⚠️  No chat turns found for session ${TARGET_SESSION_ID}`);
			console.log(`  Please check if the session ID is correct`);
			throw new Error(`No chat turns found for session ${TARGET_SESSION_ID}`);
		}

		console.log(`  Found ${chatTurns.length} chat turns`);

		console.log(`  🔍 Generating factual recaps with ${RECAP_MODEL}...`);
		let currentState = await processFactualRecap(TARGET_SESSION_ID, chatTurns, progressState);

		console.log(`  💝 Generating relationship recaps with ${RECAP_MODEL}...`);
		currentState = await processRelationshipRecap(TARGET_SESSION_ID, chatTurns, currentState);

		console.log(`  📖 Generating story documents with ${STORY_MODEL}...`);
		currentState = await processStoryDocument(TARGET_SESSION_ID, chatTurns, currentState);

		const completedState = markCompleted(currentState);
		await saveProgress(completedState);
		console.log(`  ✅ Session ${TARGET_SESSION_ID} completed successfully`);

		// 완료 후 물리적 파일로 추출
		console.log('\n📁 Exporting recaps to files...');
		await exportRecapsToFiles(TARGET_SESSION_ID, completedState);

		console.log('\n🎉 Recap generation completed successfully!');
		console.log(`📊 Progress file: ${PROGRESS_FILE}`);
		console.log(`📁 Output directory: ${OUTPUT_DIR}`);

		try {
			await writeFile(PROGRESS_FILE + '.completed', JSON.stringify(completedState, null, 2));
			console.log('📋 Progress file backed up as .completed');
		} catch (error) {
			console.warn('Warning: Could not backup progress file:', error);
		}
	} catch (error) {
		console.error(`  ❌ Error processing session ${TARGET_SESSION_ID}:`, error);
		console.error(
			`\n🛑 Processing stopped due to error. Run the script again to resume from this point.`
		);
		process.exit(1);
	}
};

// --- Run the script ---
generateInitialRecaps().catch((error) => {
	console.error('Fatal error during recap generation:', error);
	process.exit(1);
});
