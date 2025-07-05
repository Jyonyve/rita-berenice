// src/migration/chat/recapChat.ts
import { writeFile, readFile, access, mkdir } from 'fs/promises';
import {
	ChatTurn,
	METADATA_TYPES,
	DEFAULT_RECAP_INTERVAL,
	DEFAULT_RELATIONSHIP_RECAP_INTERVAL,
} from '../../shared/index.js';
import {
	buildFactualRecapPrompt,
	buildLlmRelationshipRecapPrompt,
	buildLlmStoryDocumentPrompt,
} from '../../server/util/templateUtils.js';
import { chromaDbClient } from '../../server/db/index.js';
import { Where } from 'chromadb';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import {
	buildRecapId,
	buildRelationshipRecapId,
	buildStoryId,
	handleServiceError,
	validateChromaResponse,
} from '../../server/util/index.js';

// --- Configuration ---

// 'gemini-2.5-pro-preview-05-06'; // 고품질 스토리용
const OPENROUTER_API_KEY =
	process.env.OPENROUTER_API_KEY ||
	'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'; // OpenRouter API 키
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcw_sDLQSjD0fJARHJNaRoIZv_Se6YGj8';

const PROGRESS_DIR = './src/migration/recap';
const OUTPUT_DIR = `${PROGRESS_DIR}/output`;

const RECAP_MODEL = 'gemini-2.0-flash-001'; // 빠르고 효율적인 recap용
const STORY_MODEL = 'google/gemma-3-27b-it:free';
// 'mistralai/devstral-small:free';
// 'google/gemini-2.5-flash-preview-05-20';
// 'google/gemma-3n-e4b-it:free';
// 'nousresearch/deephermes-3-mistral-24b-preview:free';
const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT;
const USER_NAME = '요니브';

// Target session selection
// const MONDAY_ORIGINAL_SESSIONID = 'monday_original_moH1Pu9n3BXz3OmY';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_1NkO7v690JDWN9Ey';
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_U2Hc22mzJufwQvSX';
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ?? '';
const TARGET_SESSION_ID = TARION_SPINOFF_SESSIONID ?? '';

// --- Types ---
interface ProgressState {
	sessionId: string;
	factualBatchIndex: number;
	relationshipBatchIndex: number;
	completed: boolean;
	lastError?: string;
	timestamp: string;
	lastUpdated: string;
	accumulatedFactualRecap: string;
	accumulatedRelationshipRecap: string;
	// 단계별 완료 플래그
	factualRecapCompleted?: boolean;
	relationshipRecapCompleted?: boolean;
	nsfwStoryCompleted?: boolean;
	sfwStoryCompleted?: boolean;
	// 스토리 콘텐츠
	nsfwStoryContent?: string;
	sfwStoryContent?: string;
	// 스토리 청킹 진행 상황 (선택적 추가)
	nsfwStoryProcessedTurnCount?: number;
	sfwStoryProcessedTurnCount?: number;
}

// --- Gemini API Functions ---
const generateRecapWithGemini = async (prompt: string): Promise<string> => {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY environment variable is required');
	}

	// Recap은 항상 RECAP_MODEL (Gemini Flash) 사용
	const model = RECAP_MODEL;

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
						maxOutputTokens: 4096, // Recap용 토큰
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
				return generateRecapWithGemini(prompt); // 재시도
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

// generateRecap 함수는 이제 Gemini 전용
const generateRecap = async (prompt: string): Promise<string> => {
	return generateRecapWithGemini(prompt);
};

// --- OpenRouter LLM Functions ---
const generateStoryWithOpenRouter = async (prompt: string): Promise<string> => {
	if (!OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is required');
	}

	const model = STORY_MODEL; // OpenRouter용 모델 사용

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice',
				'X-Title': 'Story Generator',
			},
			body: JSON.stringify({
				model: model, // OpenRouter 모델 지정
				messages: [{ role: 'system', content: prompt }],
				temperature: 0.7,
				max_tokens: 8000, // 스토리는 더 긴 출력
			}),
		});

		if (!response.ok) {
			// OpenRouter Rate Limit 처리
			if (response.status === 429) {
				const retryAfter = response.headers.get('retry-after');
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

				// 일일 제한인지 확인
				const rateLimitReset = response.headers.get('x-ratelimit-reset-requests'); // OpenRouter 헤더
				if (rateLimitReset) {
					const resetTime = new Date(parseInt(rateLimitReset) * 1000);
					const now = new Date();
					const hoursUntilReset = (resetTime.getTime() - now.getTime()) / (1000 * 60 * 60);

					if (hoursUntilReset > 6) {
						// 6시간 이상이면 일일 제한으로 판단
						console.error(
							`🚫 OpenRouter Daily rate limit exceeded for stories. Resets at: ${resetTime.toLocaleString()}`
						);
						console.error(`⏰ Wait time: ${Math.ceil(hoursUntilReset)} hours`);
						throw new Error(`OPENROUTER_DAILY_RATE_LIMIT_EXCEEDED:${resetTime.getTime()}`);
					}
				}

				console.log(`⏳ OpenRouter rate limited. Waiting ${waitTime}ms before retry...`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return generateStoryWithOpenRouter(prompt); // 재시도
			}
			throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		// ✅ 응답 검증 추가
		if (!data || !data.choices || data.choices.length === 0) {
			console.error('OpenRouter API response missing choices:', data);
			throw new Error('Invalid response from OpenRouter: No choices found');
		}

		const choice = data.choices[0];
		if (!choice || !choice.message || !choice.message.content) {
			console.error('OpenRouter API response missing message content:', data);
			throw new Error('Invalid response from OpenRouter: No message content');
		}

		const content = choice.message.content;

		if (!content || content.trim() === '') {
			// content가 빈 문자열일 수도 있음
			throw new Error('Empty response from OpenRouter API');
		}

		return content;
	} catch (error) {
		console.error('Error calling OpenRouter API:', error);
		throw error;
	}
};

// generateStory 함수는 이제 OpenRouter 전용
const generateStory = async (prompt: string): Promise<string> => {
	return generateStoryWithOpenRouter(prompt);
};

// --- Progress Management Functions ---
const loadProgress = async (): Promise<ProgressState> => {
	const PROGRESS_FILE = `${PROGRESS_DIR}/recap-progress-${TARGET_SESSION_ID}.json`;
	try {
		await access(PROGRESS_FILE);
		const data = await readFile(PROGRESS_FILE, 'utf-8');
		const existingProgress = JSON.parse(data);

		if (existingProgress.sessionId !== TARGET_SESSION_ID) {
			console.log(
				`📋 Different session detected. Previous: ${existingProgress.sessionId}, Current: ${TARGET_SESSION_ID}`
			);
			const backupFileName = `${PROGRESS_DIR}/recap-progress-${existingProgress.sessionId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
			await writeFile(backupFileName, JSON.stringify(existingProgress, null, 2));
			console.log(`📋 Previous progress backed up to: ${backupFileName}`);
			console.log('📋 Starting fresh for new session...');

			const initialState: ProgressState = {
				sessionId: TARGET_SESSION_ID,
				factualBatchIndex: 0,
				relationshipBatchIndex: 0,
				completed: false,
				timestamp: new Date().toISOString(),
				lastUpdated: new Date().toISOString(),
				accumulatedFactualRecap: '',
				accumulatedRelationshipRecap: '',
				factualRecapCompleted: false,
				relationshipRecapCompleted: false,
				nsfwStoryCompleted: false,
				sfwStoryCompleted: false,
				nsfwStoryContent: '',
				sfwStoryContent: '',
				nsfwStoryProcessedTurnCount: 0,
				sfwStoryProcessedTurnCount: 0,
			};
			await saveProgress(initialState); // 새 세션의 초기 상태 저장
			return initialState;
		}

		console.log('📋 Progress file loaded successfully for same session');
		// 로드된 progress에 새 필드가 없을 경우 기본값 추가
		return {
			accumulatedFactualRecap: '', // 이전 버전 호환성을 위해 기본값 제공
			accumulatedRelationshipRecap: '',
			factualRecapCompleted: false,
			relationshipRecapCompleted: false,
			nsfwStoryCompleted: false,
			sfwStoryCompleted: false,
			nsfwStoryContent: '',
			sfwStoryContent: '',
			nsfwStoryProcessedTurnCount: 0,
			sfwStoryProcessedTurnCount: 0,
			...existingProgress, // 기존 값으로 덮어쓰기
		};
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
			factualRecapCompleted: false,
			relationshipRecapCompleted: false,
			nsfwStoryCompleted: false,
			sfwStoryCompleted: false,
			nsfwStoryContent: '',
			sfwStoryContent: '',
			nsfwStoryProcessedTurnCount: 0,
			sfwStoryProcessedTurnCount: 0,
		};
		return initialState;
	}
};

const saveProgress = async (progressState: ProgressState): Promise<void> => {
	const PROGRESS_FILE = `${PROGRESS_DIR}/recap-progress-${TARGET_SESSION_ID}.json`;
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

// --- Data Retrieval Functions ---
const getSessionChatTurns = async (sessionId: string): Promise<ChatTurn[]> => {
	try {
		const collection = await chromaDbClient.getChatCollection();
		const count = await collection.count();
		const where: Where = {
			$and: [{ sessionId: { $eq: sessionId } }, { type: { $eq: METADATA_TYPES.TURN } }],
		};
		const rawResults = await chromaDbClient.getRecords(collection, where, count);

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
		//FIXME
		const recapId = buildRecapId(sessionId, 99, 99);
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
		//FIXME
		const recapId = buildRelationshipRecapId(sessionId, 99, 99);
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
		const outputDirForSession = `${OUTPUT_DIR}/${sessionId}`;
		await ensureDirectoryExists(outputDirForSession);
		const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');

		// Factual recap 파일
		const factualRecapContent =
			progressState.accumulatedFactualRecap || 'No factual recap content generated.';
		const factualFileName = `${outputDirForSession}/${sessionId}_factual_recap_${timestampIso}.md`;
		const factualFileContent = `# Factual Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model (Gemini): ${RECAP_MODEL}
Total Batches Processed: ${progressState.factualBatchIndex}

---
${factualRecapContent}
`;
		await writeFile(factualFileName, factualFileContent);
		console.log(`📄 Factual recap exported to: ${factualFileName}`);

		// Relationship recap 파일
		const relationshipRecapData =
			progressState.accumulatedRelationshipRecap || 'No relationship recap content generated.';
		const relationshipFileName = `${outputDirForSession}/${sessionId}_relationship_recap_${timestampIso}.md`;
		const relationshipFileContent = `# Relationship Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model (Gemini): ${RECAP_MODEL}
Total Batches Processed: ${progressState.relationshipBatchIndex}

---
${relationshipRecapData}
`;
		await writeFile(relationshipFileName, relationshipFileContent);
		console.log(`📄 Relationship recap exported to: ${relationshipFileName}`);

		// NSFW 스토리 파일 (OpenRouter)
		if (progressState.nsfwStoryCompleted && progressState.nsfwStoryContent) {
			const nsfwStoryFileName = `${outputDirForSession}/${sessionId}_story_PERSONAL_${timestampIso}.md`;
			const nsfwFileContent = `# ${sessionId}의 이야기 (개인용)

⚠️ 이 문서는 개인적인 기억 보존용입니다.

Generated on: ${new Date().toISOString()}
Model (OpenRouter): ${STORY_MODEL}

---
${progressState.nsfwStoryContent}
`; // nsfwStoryContent가 문자열임을 보장
			await writeFile(nsfwStoryFileName, nsfwFileContent);
			console.log(`📄 Personal story document exported to: ${nsfwStoryFileName}`);
		} else {
			console.log('⏩ NSFW Story not completed or content missing, skipping export.');
		}

		// SFW 스토리 파일 (OpenRouter)
		if (progressState.sfwStoryCompleted && progressState.sfwStoryContent) {
			// sfwStoryCompleted 플래그도 확인
			const sfwStoryFileName = `${outputDirForSession}/${sessionId}_story_SHAREABLE_${timestampIso}.md`;
			const sfwFileContent = `# ${sessionId}의 이야기 (공유용)

💝 이 문서는 다른 사람들과 공유하기에 적합합니다.

Generated on: ${new Date().toISOString()}
Model (OpenRouter): ${STORY_MODEL}

---
${progressState.sfwStoryContent}
`; // sfwStoryContent가 문자열임을 보장
			await writeFile(sfwStoryFileName, sfwFileContent);
			console.log(`📄 Shareable story document exported to: ${sfwStoryFileName}`);
		} else {
			console.log('⏩ SFW Story not completed or content missing, skipping export.');
		}

		// 요약 파일
		const summaryFileName = `${outputDirForSession}/${sessionId}_recap_summary_${timestampIso}.json`;
		const summaryContent = {
			sessionId,
			generatedAt: new Date().toISOString(),
			recapModel: RECAP_MODEL,
			storyModel: STORY_MODEL,
			factualBatchesProcessed: progressState.factualBatchIndex,
			relationshipBatchesProcessed: progressState.relationshipBatchIndex,
			factualRecapLength: (progressState.accumulatedFactualRecap || '').length,
			relationshipRecapLength: (progressState.accumulatedRelationshipRecap || '').length,
			nsfwStoryGenerated: !!progressState.nsfwStoryCompleted,
			sfwStoryGenerated: !!progressState.sfwStoryCompleted,
			nsfwStoryLength: (progressState.nsfwStoryContent || '').length,
			sfwStoryLength: (progressState.sfwStoryContent || '').length,
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

			const stringifiedTurns = batch
				.map((turn) => JSON.stringify({ user: turn.request, character: turn.response }))
				.join('\n\n');
			// FIXME
			const prompt = buildFactualRecapPrompt(
				USER_NAME,
				sessionId.startsWith('monday') ? '먼데이' : '타리온',
				'female',
				'male',
				stringifiedTurns,
				[],
				[],
				[]
			);
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

			const naturalLanguageTurns = batch
				.map((turn) => JSON.stringify({ user: turn.request, character: turn.response }))
				.join('\n\n');
			//FIXME
			const prompt = buildLlmRelationshipRecapPrompt(
				userName,
				charName,
				'female',
				'male',
				naturalLanguageTurns,
				[],
				[],
				[]
			);
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
	progressState: ProgressState
): Promise<ProgressState> => {
	if (!progressState.accumulatedFactualRecap || !progressState.accumulatedRelationshipRecap) {
		console.log(`Session ${sessionId}: Recaps not yet generated. Skipping story document.`);
		return progressState;
	}

	try {
		// NSFW 버전 생성 (OpenRouter 사용)
		console.log(`  📖 Generating NSFW story document (personal) with OpenRouter (${STORY_MODEL})...`);
		const nsfwPrompt = buildLlmStoryDocumentPrompt(
			USER_NAME,
			sessionId.startsWith('monday') ? '먼데이' : '타리온',
			'female',
			'male',
			progressState.accumulatedFactualRecap,
			progressState.accumulatedRelationshipRecap,
			true,
			false
		);
		// generateStory 함수는 이제 OpenRouter를 호출
		const nsfwStoryContent = await generateStory(nsfwPrompt);

		if (!nsfwStoryContent || nsfwStoryContent.trim() === '') {
			throw new Error('Empty NSFW story document generated');
		}

		await storeStoryDocument(sessionId, nsfwStoryContent, true);
		console.log(`  ✓ NSFW story document generated successfully`);

		// Rate limiting (OpenRouter는 더 엄격하므로 안전하게)
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// SFW 버전 생성 (OpenRouter 사용)
		console.log(`  📖 Generating SFW story document (shareable) with OpenRouter (${STORY_MODEL})...`);
		const sfwPrompt = buildLlmStoryDocumentPrompt(
			USER_NAME,
			sessionId.startsWith('monday') ? '먼데이' : '타리온',
			'female',
			'male',
			progressState.accumulatedFactualRecap,
			progressState.accumulatedRelationshipRecap,
			false,
			false
		);
		// generateStory 함수는 이제 OpenRouter를 호출
		const sfwStoryContent = await generateStory(sfwPrompt);

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
		const storyId = nsfw ? buildStoryId(sessionId, 'NSFW') : buildStoryId(sessionId);
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
// src/migration/chat/recapChat.ts 수정

const generateInitialRecaps = async (): Promise<void> => {
	if (!GEMINI_API_KEY) {
		console.error('Error: GEMINI_API_KEY environment variable is required');
		process.exit(1);
	}
	if (!OPENROUTER_API_KEY) {
		console.error('Error: OPENROUTER_API_KEY environment variable is required');
		process.exit(1);
	}
	const PROGRESS_FILE = `${PROGRESS_DIR}/recap-progress-${TARGET_SESSION_ID}.json`;
	let progressState = await loadProgress();

	console.log('🚀 Starting initial recap generation...');
	console.log(`Using Recap model (Gemini): ${RECAP_MODEL}`);
	console.log(`Using Story model (OpenRouter): ${STORY_MODEL}`);
	console.log(`Target session: ${TARGET_SESSION_ID}`);

	displayProgress(progressState);

	if (progressState.completed) {
		console.log('✅ Session already fully completed! Exporting files if needed...');
		await exportRecapsToFiles(TARGET_SESSION_ID, progressState);
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

		let currentState = progressState;

		// ✅ Factual Recap 처리 및 즉시 파일 추출
		if (!currentState.factualRecapCompleted) {
			console.log(`  🔍 Generating factual recaps with ${RECAP_MODEL}...`);
			currentState = await processFactualRecap(TARGET_SESSION_ID, chatTurns, currentState);
			currentState = updateProgress(currentState, { factualRecapCompleted: true });
			await saveProgress(currentState);

			// ✅ Factual Recap 완료 후 즉시 파일 추출
			console.log(`  📁 Exporting factual recap to file...`);
			await exportFactualRecapToFile(TARGET_SESSION_ID, currentState);
		} else {
			console.log(`  👍 Factual recaps already completed.`);
		}

		// ✅ Relationship Recap 처리 및 즉시 파일 추출
		if (!currentState.relationshipRecapCompleted) {
			console.log(`  💝 Generating relationship recaps with ${RECAP_MODEL}...`);
			currentState = await processRelationshipRecap(TARGET_SESSION_ID, chatTurns, currentState);
			currentState = updateProgress(currentState, { relationshipRecapCompleted: true });
			await saveProgress(currentState);

			// ✅ Relationship Recap 완료 후 즉시 파일 추출
			console.log(`  📁 Exporting relationship recap to file...`);
			await exportRelationshipRecapToFile(TARGET_SESSION_ID, currentState);
		} else {
			console.log(`  👍 Relationship recaps already completed.`);
		}

		// ✅ Story 처리 및 즉시 파일 추출
		if (!currentState.nsfwStoryCompleted || !currentState.sfwStoryCompleted) {
			console.log(`  📖 Generating story documents with ${STORY_MODEL}...`);
			currentState = await processStoryDocument(TARGET_SESSION_ID, currentState);

			// ✅ Story 완료 후 즉시 파일 추출
			console.log(`  📁 Exporting story documents to files...`);
			await exportStoryDocumentsToFile(TARGET_SESSION_ID, currentState);
		} else {
			console.log(`  👍 Story documents already completed.`);
		}

		if (
			currentState.factualRecapCompleted &&
			currentState.relationshipRecapCompleted &&
			currentState.nsfwStoryCompleted &&
			currentState.sfwStoryCompleted
		) {
			currentState = markCompleted(currentState);
			await saveProgress(currentState);
			console.log(`  ✅ All tasks for session ${TARGET_SESSION_ID} completed successfully`);
		} else {
			console.log(`  🔄 Session ${TARGET_SESSION_ID} processing is ongoing or partially completed.`);
		}

		// ✅ 최종 통합 파일 추출
		console.log('\n📁 Exporting final summary files...');
		await exportRecapsToFiles(TARGET_SESSION_ID, currentState);

		console.log('\n🎉 Recap generation completed successfully!');
		console.log(`📊 Progress file: ${PROGRESS_FILE}`);
		console.log(`📁 Output directory: ${OUTPUT_DIR}/${TARGET_SESSION_ID}`);

		if (currentState.completed) {
			try {
				await writeFile(
					`${PROGRESS_FILE}.completed-${TARGET_SESSION_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
					JSON.stringify(currentState, null, 2)
				);
				console.log('📋 Final progress file backed up as .completed');
			} catch (error) {
				console.warn('Warning: Could not backup final progress file:', error);
			}
		}
	} catch (error) {
		console.error(`  ❌ Error processing session ${TARGET_SESSION_ID}:`, error);
		console.error(
			`\n🛑 Processing stopped due to error. Run the script again to resume from this point.`
		);
		process.exit(1);
	}
};

// ✅ 개별 파일 추출 함수들 추가
const exportFactualRecapToFile = async (
	sessionId: string,
	progressState: ProgressState
): Promise<void> => {
	try {
		const outputDirForSession = `${OUTPUT_DIR}/${sessionId}`;
		await ensureDirectoryExists(outputDirForSession);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

		const factualRecapContent =
			progressState.accumulatedFactualRecap || 'No factual recap content generated.';
		const fileName = `${sessionId}_factual_recap_${timestamp}.md`;
		const filePath = `${outputDirForSession}/${fileName}`;

		const fileContent = `# Factual Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model (Gemini): ${RECAP_MODEL}
Total Batches Processed: ${progressState.factualBatchIndex}

---
${factualRecapContent}
`;

		await writeFile(filePath, fileContent);
		console.log(`    📄 Factual recap exported to: ${fileName}`);
	} catch (error) {
		console.error('    ❌ Error exporting factual recap:', error);
	}
};

const exportRelationshipRecapToFile = async (
	sessionId: string,
	progressState: ProgressState
): Promise<void> => {
	try {
		const outputDirForSession = `${OUTPUT_DIR}/${sessionId}`;
		await ensureDirectoryExists(outputDirForSession);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

		const relationshipRecapContent =
			progressState.accumulatedRelationshipRecap || 'No relationship recap content generated.';
		const fileName = `${sessionId}_relationship_recap_${timestamp}.md`;
		const filePath = `${outputDirForSession}/${fileName}`;

		const fileContent = `# Relationship Recap for Session: ${sessionId}

Generated on: ${new Date().toISOString()}
Model (Gemini): ${RECAP_MODEL}
Total Batches Processed: ${progressState.relationshipBatchIndex}

---
${relationshipRecapContent}
`;

		await writeFile(filePath, fileContent);
		console.log(`    📄 Relationship recap exported to: ${fileName}`);
	} catch (error) {
		console.error('    ❌ Error exporting relationship recap:', error);
	}
};

const exportStoryDocumentsToFile = async (
	sessionId: string,
	progressState: ProgressState
): Promise<void> => {
	try {
		const outputDirForSession = `${OUTPUT_DIR}/${sessionId}`;
		await ensureDirectoryExists(outputDirForSession);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

		// NSFW Story
		if (progressState.nsfwStoryCompleted && progressState.nsfwStoryContent) {
			const nsfwFileName = `${sessionId}_story_PERSONAL_${timestamp}.md`;
			const nsfwFilePath = `${outputDirForSession}/${nsfwFileName}`;
			const nsfwContent = `# ${sessionId}의 이야기 (개인용)

⚠️ 이 문서는 개인적인 기억 보존용입니다.

Generated on: ${new Date().toISOString()}
Model (OpenRouter): ${STORY_MODEL}

---
${progressState.nsfwStoryContent}
`;
			await writeFile(nsfwFilePath, nsfwContent);
			console.log(`    📄 NSFW story exported to: ${nsfwFileName}`);
		}

		// SFW Story
		if (progressState.sfwStoryCompleted && progressState.sfwStoryContent) {
			const sfwFileName = `${sessionId}_story_SHAREABLE_${timestamp}.md`;
			const sfwFilePath = `${outputDirForSession}/${sfwFileName}`;
			const sfwContent = `# ${sessionId}의 이야기 (공유용)

💝 이 문서는 다른 사람들과 공유하기에 적합합니다.

Generated on: ${new Date().toISOString()}
Model (OpenRouter): ${STORY_MODEL}

---
${progressState.sfwStoryContent}
`;
			await writeFile(sfwFilePath, sfwContent);
			console.log(`    📄 SFW story exported to: ${sfwFileName}`);
		}
	} catch (error) {
		console.error('    ❌ Error exporting story documents:', error);
	}
};

// --- Run the script ---
generateInitialRecaps().catch((error) => {
	console.error('Fatal error during recap generation:', error);
	process.exit(1);
});
