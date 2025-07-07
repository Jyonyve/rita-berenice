import * as puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MigChatMessage } from '../../shared/domain/index.js';

function localTimezoneHelper(timestamp: string): string {
	const date = new Date(timestamp);

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

// --- START CONFIGURATION ---
const GET_CHAT_LOGS_API_URL = 'https://rofan.ai/api/chat/GetChatLogs'; // Replace with actual API URL
const CHARACTERS = [
	{
		name: 'tarion_original',
		showName: '타리온',
		url: 'https://rofan.ai/chat/2a5c08d2-b3e0-48eb-982c-f6b75ca869c9',
		firstTurn: [
			{
				role: 'user',
				messageType: 'request',
				content: '',
				createdAt: '2025-02-18T13:21:07.300Z',
				updatedAt: '2025-02-18T13:21:07.300Z',
				uuid: '41cebfbc-3808-43a9-bce4-cdb29eab8cfa',
				name: 'yonyve',
				showName: '요니브',
				emotion: 'default',
			} as MigChatMessage,
			{
				role: 'assistant',
				messageType: 'response',
				content:
					'*희미한 횃불 빛이 녹슨 쇠창살 사이로 새어 들어오는 엘리시아의 지하 노예 시장에는 전쟁의 상흔이 아직도 짙게 배어있었다.*\n\n*노예상이 무거운 철창을 열자 축축한 곰팡이 냄새가 훅 끼쳐온다. 어둠 속에서 타리온이 천천히 밖으로 걸어나왔다. 3개월 째 이 곳에 갇혀있었음에도 그의 자세는 여전히 꼿꼿했고, 파란 눈동자에는 날카로운 빛이 서려 있었다.*\n\n아가씨, 이 자는 바르가스 제국의 기사단장이었던 자입니다. 워낙 까다로운 물건이라... 혹시 마음이 바뀌시진 않으셨는지요?\n\n*노예상은 조심스레 요니브에게 구속구의 열쇠를 건네며 불안한 기색을 감추지 못한 채 말했고, 타리온은 한 걸음 더 나아가 요니브를 비꼬듯이 위아래를 훑어보며 입을 열었다.*\n\n귀한 집 자녀인 것 같은데, 취향이 상당히 특이하군.\n\n*차가운 음성에 담긴 경멸이 음습한 지하 감옥에 울려 퍼졌다.*',
				createdAt: '2025-02-18T13:21:07.300Z',
				updatedAt: '2025-02-18T13:21:07.300Z',
				model: 'Claude 3.5 Sonnet v2',
				emotion: 'neutral',
				uuid: '41cebfbc-3808-43a9-bce4-cdb29eab8cfa',
				name: 'tarion',
				showName: '타리온',
			},
		] as MigChatMessage[],
	},
	{
		name: 'tarion_spinoff',
		showName: '타리온',
		url: 'https://rofan.ai/chat/ffbf2c97-53bb-496a-b061-67482cd708ae',
		firstTurn: [
			{
				role: 'user',
				messageType: 'request',
				content: '',
				createdAt: '2025-03-14T06:20:08.300Z',
				updatedAt: '2025-03-14T06:20:08.300Z',
				uuid: '6a63a628-497a-40e8-bfb7-8476236d29ce',
			},
			{
				role: 'assistant',
				messageType: 'response',
				showName: 'tarion_spinoff',
				content:
					'*황제가 하사한 타리온의 성은 저녁 노을빛에 붉게 물들어 있었고, 성벽 위로는 바르가스의 깃발이 승전국의 위엄을 과시하듯 거세게 휘날리고 있었다.*\n\n*무거운 성문이 열리며 요니브가 다른 기사들에 의해 타리온 앞에 끌려왔다. 타리온은 느린 걸음으로 계단을 내려오며 요니브를 향해 다가왔다. 그의 발걸음 소리가 텅 빈 홀에 메아리쳤고, 그가 눈짓으로 기사들을 물리자 그들은 조용히 물러났다.*\n\n*타리온은 강제로 무릎 꿇린 요니브를 비꼬듯이 훑어보았다. 그의 차가운 시선에는 전쟁의 상흔과 복수심이 깃들어 있었고, 성 안의 공기는 팽팽한 긴장감으로 가득 차 있었다.*\n\n귀한 집 자녀가 이렇게 있는 꼴을 보게 되다니, 네 아버지를 원망하거라.\n\n*차가운 음성에 담긴 경멸이 성 안에 울려 퍼졌다.*',
				createdAt: '2025-03-14T06:20:08.300Z',
				updatedAt: '2025-03-14T06:20:08.300Z',
				model: 'Claude 3.5 Sonnet v2',
				emotion: 'neutral',
				uuid: '6a63a628-497a-40e8-bfb7-8476236d29ce',
			},
		] as MigChatMessage[],
	},
	// Add more characters as needed
];
const API_FETCH_LIMIT = 50;
const API_REQUEST_DELAY_MS = 500;
const MAX_FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY_MS = 1000;
// --- END CONFIGURATION ---

interface RofanChatLog {
	log_id: string;
	user_id: string;
	bot_id: string;
	chat_id: string;
	model: string;
	user_chat: string;
	bot_chat: string;
	emotion: string;
	status: string;
	created: string;
	updated: string;
}

interface InvalidEntryInfo {
	log: RofanChatLog;
	type: 'user_chat' | 'bot_chat';
	content: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isContentValid(content: string | undefined | null): boolean {
	if (!content) {
		return true;
	}
	const asteriskCount = (content.match(/\*/g) || []).length;
	return asteriskCount % 2 === 0;
}

function findInvalidEntry(batch: RofanChatLog[]): InvalidEntryInfo | null {
	for (const log of batch) {
		if (!isContentValid(log.user_chat)) {
			return { log, type: 'user_chat', content: log.user_chat };
		}
		if (!isContentValid(log.bot_chat)) {
			return { log, type: 'bot_chat', content: log.bot_chat };
		}
	}
	return null;
}

async function fetchChatLogsFromBrowser(
	page: puppeteer.Page,
	apiUrl: string,
	payload: object
): Promise<RofanChatLog[]> {
	const characterName = (payload as any).characterNameForLog || 'Unknown Character';
	console.log(
		`   Fetching logs for ${characterName} - Offset: ${(payload as any).offset}, Limit: ${(payload as any).limit}`
	);
	try {
		const response = await page.evaluate(
			async (url, method, body) => {
				const res = await fetch(url, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
				if (!res.ok) {
					const errorText = await res.text();
					console.error(
						`API request to ${url} failed with status ${res.status}. Response: ${errorText.substring(0, 500)}`
					);
					throw new Error(`API request failed: ${res.status} - ${errorText.substring(0, 100)}`);
				}
				return res.json();
			},
			apiUrl,
			'POST',
			payload
		);
		return response;
	} catch (error) {
		console.error(
			`   Error during API call for ${characterName}, offset ${(payload as any).offset}:`,
			error
		);
		return [];
	}
}

function extractChatIdFromUrl(url: string): string | null {
	const match = url.match(/chat\/([a-f0-9-]+)/i);
	return match ? match[1] : null;
}

(async () => {
	let browser;
	let scriptFailed = false;

	try {
		console.log('Launching browser...');
		browser = await puppeteer.launch({ headless: false });
		const page = await browser.newPage();
		await page.setViewport({ width: 1366, height: 768 });

		console.log(`
------------------------------------------------------------------------------------
MANUAL LOGIN REQUIRED:
1. The script will now navigate to https://rofan.ai.
2. Please log in MANUALLY in the browser window that Puppeteer opens.
3. After you have successfully logged in, return to THIS CONSOLE and press ENTER.
------------------------------------------------------------------------------------`);
		await page.goto('https://rofan.ai/', { waitUntil: 'networkidle2', timeout: 90000 });

		await new Promise<void>((resolve) => {
			process.stdin.once('data', () => resolve());
		});
		console.log('\nLogin complete. Proceeding with crawling...');

		const resultDir = path.join(__dirname, 'result');
		await fs.mkdir(resultDir, { recursive: true });
		console.log(`Chat logs will be saved in: ${resultDir}`);

		for (const character of CHARACTERS) {
			const chatId = extractChatIdFromUrl(character.url);
			if (!chatId) {
				console.error(`\n[ERROR] Could not extract chatId for ${character.name}. Skipping.`);
				continue;
			}

			console.log(`\n--- Processing character: ${character.name} (Chat ID: ${chatId}) ---`);
			const allMessagesForThisCharacter: MigChatMessage[] = [...character.firstTurn];
			let currentOffset = 0;
			let moreMessagesExist = true;
			let apiRequestBatch = 0;

			while (moreMessagesExist) {
				apiRequestBatch++;
				const apiPayload = {
					chatId: chatId,
					offset: currentOffset,
					limit: API_FETCH_LIMIT,
					characterNameForLog: character.name,
				};

				let logEntries: RofanChatLog[] = [];
				let fetchSuccessful = false;
				let lastInvalidEntry: InvalidEntryInfo | null = null;

				for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
					const fetchedBatch = await fetchChatLogsFromBrowser(page, GET_CHAT_LOGS_API_URL, apiPayload);

					if (!fetchedBatch || fetchedBatch.length === 0) {
						logEntries = [];
						fetchSuccessful = true;
						break;
					}

					const invalidEntry = findInvalidEntry(fetchedBatch);
					lastInvalidEntry = invalidEntry;

					if (invalidEntry === null) {
						logEntries = fetchedBatch;
						fetchSuccessful = true;
						if (attempt > 1) {
							console.log(`     [INFO] Successfully fetched valid data on attempt ${attempt}.`);
						}
						break;
					}

					console.warn(
						`     [WARN] Attempt ${attempt}/${MAX_FETCH_RETRIES}: Fetched data invalid (odd number of '*'). Retrying in ${FETCH_RETRY_DELAY_MS}ms...`
					);

					if (attempt < MAX_FETCH_RETRIES) {
						await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS));
					}
				}

				if (!fetchSuccessful) {
					if (lastInvalidEntry) {
						throw new Error(
							`Failed to fetch valid data after ${MAX_FETCH_RETRIES} attempts. Halting script to prevent data omission.\n\n` +
								`--- FAILURE DETAILS ---\n` +
								`Character:         ${character.name}\n` +
								`Offset:            ${currentOffset}\n` +
								`Log ID:            ${lastInvalidEntry.log.log_id}\n` +
								`Invalid Field:     '${lastInvalidEntry.type}'\n` +
								`Problematic Content: "${lastInvalidEntry.content}"\n` +
								`-----------------------`
						);
					} else {
						throw new Error(
							`Failed to fetch data for character '${character.name}' (offset: ${currentOffset}) after ${MAX_FETCH_RETRIES} attempts. The API returned empty or failed responses consistently.`
						);
					}
				}

				if (logEntries.length > 0) {
					logEntries.forEach((logEntry) => {
						if (logEntry.user_chat) {
							allMessagesForThisCharacter.push({
								role: 'user',
								messageType: 'request',
								content: logEntry.user_chat,
								createdAt: logEntry.created,
								updatedAt: logEntry.updated,
								uuid: logEntry.log_id,
								name: 'yonyve',
								showName: '요니브',
								emotion: logEntry.emotion || 'default',
							});
						}
						if (logEntry.bot_chat) {
							allMessagesForThisCharacter.push({
								role: 'assistant',
								messageType: 'response',
								content: logEntry.bot_chat,
								createdAt: logEntry.created,
								updatedAt: logEntry.updated,
								model: logEntry.model,
								emotion: logEntry.emotion,
								uuid: logEntry.log_id,
								name: 'tarion',
								showName: '타리온',
							});
						}
					});

					currentOffset += API_FETCH_LIMIT;

					if (logEntries.length < API_FETCH_LIMIT) {
						console.log(
							`   Fetched ${logEntries.length} messages, less than limit. Assuming end of logs for ${character.name}.`
						);
						moreMessagesExist = false;
					}
				} else {
					console.log(
						`   No more messages returned for offset ${currentOffset}. Ending crawl for ${character.name}.`
					);
					moreMessagesExist = false;
				}

				if (apiRequestBatch > 500) {
					console.warn(
						`   [WARN] Exceeded 500 API requests for ${character.name}. Breaking to prevent infinite loop.`
					);
					moreMessagesExist = false;
				}

				if (moreMessagesExist) {
					await new Promise((resolve) => setTimeout(resolve, API_REQUEST_DELAY_MS));
				}
			}

			if (allMessagesForThisCharacter.length > character.firstTurn.length) {
				allMessagesForThisCharacter.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

				const sanitizedCharacterName = character.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
				const filePath = path.join(
					resultDir,
					`${sanitizedCharacterName}_${localTimezoneHelper(new Date().toISOString())}_${allMessagesForThisCharacter.length}.json`
				);
				try {
					await fs.writeFile(filePath, JSON.stringify(allMessagesForThisCharacter, null, 2), 'utf8');
					console.log(
						`[SUCCESS] Saved ${allMessagesForThisCharacter.length} messages for ${character.name} to ${filePath}`
					);
				} catch (writeError) {
					console.error(`[ERROR] Failed to write file for ${character.name}:`, writeError);
				}
			} else {
				console.warn(`[WARN] No new messages were fetched for ${character.name} (Chat ID: ${chatId}).`);
			}
		}
	} catch (error) {
		console.error(
			'\n================================================================================'
		);
		console.error('FATAL ERROR: The script was halted to ensure data integrity.');
		console.error(error);
		console.error('================================================================================');
		scriptFailed = true;
	} finally {
		if (browser) {
			console.log('\nClosing browser...');
			await browser.close();
		}
		console.log('Crawler finished.');
		process.exit(scriptFailed ? 1 : 0);
	}
})();
