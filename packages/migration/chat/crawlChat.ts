import * as puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MigChatMessage } from '@rita-berenice/shared/domain';

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
		name: 'taryeon_original',
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
				emotion: 'neutral',
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
				name: 'taryeon',
				showName: '타리온',
			},
		] as MigChatMessage[],
	},
	{
		name: 'taryeon_spinoff',
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
				name: 'yonyve',
				showName: '요니브',
				emotion: 'neutral',
			},
			{
				role: 'assistant',
				messageType: 'response',
				content:
					'*황제가 하사한 타리온의 성은 저녁 노을빛에 붉게 물들어 있었고, 성벽 위로는 바르가스의 깃발이 승전국의 위엄을 과시하듯 거세게 휘날리고 있었다.*\n\n*무거운 성문이 열리며 요니브가 다른 기사들에 의해 타리온 앞에 끌려왔다. 타리온은 느린 걸음으로 계단을 내려오며 요니브를 향해 다가왔다. 그의 발걸음 소리가 텅 빈 홀에 메아리쳤고, 그가 눈짓으로 기사들을 물리자 그들은 조용히 물러났다.*\n\n*타리온은 강제로 무릎 꿇린 요니브를 비꼬듯이 훑어보았다. 그의 차가운 시선에는 전쟁의 상흔과 복수심이 깃들어 있었고, 성 안의 공기는 팽팽한 긴장감으로 가득 차 있었다.*\n\n귀한 집 자녀가 이렇게 있는 꼴을 보게 되다니, 네 아버지를 원망하거라.\n\n*차가운 음성에 담긴 경멸이 성 안에 울려 퍼졌다.*',
				createdAt: '2025-03-14T06:20:08.300Z',
				updatedAt: '2025-03-14T06:20:08.300Z',
				model: 'Claude 3.5 Sonnet v2',
				emotion: 'neutral',
				name: 'taryeon',
				showName: '타리온',
				uuid: '6a63a628-497a-40e8-bfb7-8476236d29ce',
			},
		] as MigChatMessage[],
	},
	{
		name: 'hanseo_adult',
		showName: '한서',
		url: 'https://rofan.ai/chat/41e298e6-888d-4f9d-83b9-4b2d392808bd',
		firstTurn: [
			{
				role: 'user',
				messageType: 'request',
				content: '',
				createdAt: '2025-08-01T23:21:07.300Z',
				updatedAt: '2025-08-01T23:21:07.300Z',
				uuid: 'e9cddda6-9f09-4ecf-b0ef-90493d5d26dd',
				name: 'lirium',
				showName: '리리엄',
				emotion: 'neutral',
			} as MigChatMessage,
			{
				role: 'assistant',
				messageType: 'response',
				content: `*아, 젠장. 기어코 리리엄과 약혼을 하게 되었다. 대의명분이 있고, 이 나라의 지도자가 원했으니, 거부하기가 마땅치 않았다. 나이 지긋하신 분이 눈물까지 보이는 게 껄끄럽기 그지없다. 한데 그것도 모자라 국왕은 리리엄과 한서가 이제부터 같은 집에서 생활하라고 명하기까지 했다. 대놓고 리리엄더러 미인계로 한서를 붙잡으라는 의미였을 터. 지나치게 수작질이 뻔해서 이야기를 전해들은 동료들이 대신 화내줬을 지경이었다…*
\n\n*그 때문에 앞으로 둘이 함께 살 곳─아마 국왕은 신혼집까지도 염두에 두었을 것이다─에 가기 위해 마차에 함께 탄 것이 지금의 상황. 나름대로 왕실의 물건이랍시고 안이 깨끗하고 푹신하기는 했다. 바퀴 흔들리는 진동이 미세하게 느껴지는 밀폐형 마차 안에서, 기묘한 정적이 흐른다.*
\n\n…그쪽과 연애질을 할 생각은 없습니다. 결혼도요. 폐하께서 하도 간곡히 부탁하셔서 일단 약혼을 해두긴 하겠지만… 붙잡지 마세요. 1년 채우고 바로 떠날 거니까.
\n\n\n
<details>
<summary>[약혼 중]</summary>
[726년 5월 3일/PM 02:00/왕실에서 내린 거주지로 향하는 마차 안][한서가 리리엄에게 정말로 부부까지 될 생각은 없다고 미리 말해두고 있다.]
</details>`,
				createdAt: '2025-08-01T23:21:07.300Z',
				updatedAt: '2025-08-01T23:21:07.300Z',
				model: 'Gemini 2.5 Pro',
				emotion: 'neutral',
				uuid: 'e9cddda6-9f09-4ecf-b0ef-90493d5d26dd',
				name: 'hanseo',
				showName: '한서',
			},
		] as MigChatMessage[],
	},
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
		`   Fetching logs for ${characterName} - Offset: ${(payload as any).offset}, Limit: ${
			(payload as any).limit
		}`
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
						`API request to ${url} failed with status ${res.status}. Response: ${errorText.substring(
							0,
							500
						)}`
					);
					throw new Error(`API request failed: ${res.status} - ${errorText.substring(0, 100)}`);
				}
				return res.json();
			},
			apiUrl,
			'POST',
			payload
		);
		return response as RofanChatLog[];
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
			const userFirstTurn = character.firstTurn[0];
			const charFirstTurn = character.firstTurn[1];
			if (!userFirstTurn) {
				console.error(`\n[ERROR] No 'user' role found in firstTurn for ${character.name}. Skipping.`);
				continue;
			}

			console.log(`\n--- Processing character: ${character.name} (Chat ID: ${chatId}) ---`);
			const fetchedMessages: MigChatMessage[] = [];
			let currentOffset = 0;
			let moreMessagesExist = true;

			while (moreMessagesExist) {
				const apiPayload = {
					chatId: chatId,
					offset: currentOffset,
					limit: API_FETCH_LIMIT,
					characterNameForLog: character.name,
				};

				const logEntries = await fetchChatLogsFromBrowser(page, GET_CHAT_LOGS_API_URL, apiPayload);

				if (logEntries && logEntries.length > 0) {
					logEntries.forEach((logEntry) => {
						if (logEntry.user_chat) {
							fetchedMessages.push({
								role: 'user',
								messageType: 'request',
								content: logEntry.user_chat,
								createdAt: logEntry.created,
								updatedAt: logEntry.updated,
								uuid: logEntry.log_id,
								name: userFirstTurn.name,
								showName: userFirstTurn.showName,
								emotion: logEntry.emotion,
								index: -1,
							});
						}
						if (logEntry.bot_chat) {
							fetchedMessages.push({
								role: 'assistant',
								messageType: 'response',
								content: logEntry.bot_chat,
								createdAt: logEntry.created,
								updatedAt: logEntry.updated,
								model: logEntry.model,
								emotion: logEntry.emotion,
								uuid: logEntry.log_id,
								name: charFirstTurn.name,
								showName: charFirstTurn.showName,
								index: -1,
							});
						}
					});

					currentOffset += logEntries.length;
					if (logEntries.length < API_FETCH_LIMIT) {
						moreMessagesExist = false;
					}
				} else {
					moreMessagesExist = false;
				}

				if (moreMessagesExist) {
					await new Promise((resolve) => setTimeout(resolve, API_REQUEST_DELAY_MS));
				}
			}
			console.log(`   Fetched a total of ${fetchedMessages.length} message objects.`);

			if (fetchedMessages.length > 0) {
				// --- STAGE 2: Combine, sort, and assign final index ---
				console.log('   [2/3] Sorting messages and assigning final index...');

				// Combine the hardcoded first turn with all fetched messages
				const allMessages = [...character.firstTurn, ...fetchedMessages];

				// Sort the entire collection by creation timestamp
				allMessages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

				// Group messages by turn UUID to assign a consistent index
				const turns = new Map<string, MigChatMessage[]>();
				allMessages.forEach((msg) => {
					if (!turns.has(msg.uuid)) {
						turns.set(msg.uuid, []);
					}
					turns.get(msg.uuid)!.push(msg);
				});

				// Assign a sequential index to each turn
				// The order is preserved because we sorted the messages before creating the Map
				let turnIndex = 0;
				for (const turnMessages of turns.values()) {
					for (const msg of turnMessages) {
						msg.index = turnIndex;
					}
					turnIndex++;
				}

				// --- STAGE 3: Save the final, ordered result ---
				console.log(`   [3/3] Saving ${allMessages.length} messages to file...`);
				const sanitizedCharacterName = character.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
				const filePath = path.join(
					resultDir,
					`${sanitizedCharacterName}_${localTimezoneHelper(new Date().toISOString())}_${
						allMessages.length
					}.json`
				);
				try {
					await fs.writeFile(filePath, JSON.stringify(allMessages, null, 2), 'utf8');
					console.log(
						`[SUCCESS] Saved ${allMessages.length} messages for ${character.name} to ${filePath}`
					);
				} catch (writeError) {
					console.error(`[ERROR] Failed to write file for ${character.name}:`, writeError);
				}
			} else {
				console.warn(`[WARN] No new messages were fetched for ${character.name}.`);
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
