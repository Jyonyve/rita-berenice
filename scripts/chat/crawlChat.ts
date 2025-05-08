import * as puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MigChatMessage } from '../../src/shared/domain';

const GET_CHAT_LOGS_API_URL = 'https://rofan.ai/api/chat/GetChatLogs'; // !! IMPORTANT: Replace with the ACTUAL API URL from your DevTools
// 2. Update CHARACTERS with the correct 'name' and 'url' (from which chatId will be extracted)
const CHARACTERS = [
	{
		name: 'tarion_original',
		showName: '타리온',
		url: 'https://rofan.ai/chat/2a5c08d2-b3e0-48eb-982c-f6b75ca869c9',
	},
	// Example for another character:
	{ name: 'tarion_spinoff', url: 'https://rofan.ai/chat/ffbf2c97-53bb-496a-b061-67482cd708ae' },
	// Add more characters as needed
];
const API_FETCH_LIMIT = 50; // How many messages to fetch per API call (e.g., 20, 50). Adjust as needed.
const API_REQUEST_DELAY_MS = 500; // Delay between API calls in milliseconds to be respectful to the server.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to make API calls from within the browser context
async function fetchChatLogsFromBrowser(
	page: puppeteer.Page,
	apiUrl: string,
	payload: object
): Promise<any[]> {
	const characterName = (payload as any).characterNameForLog || 'Unknown Character';
	console.log(
		`  Fetching logs for ${characterName} - Offset: ${(payload as any).offset}, Limit: ${(payload as any).limit}`
	);
	try {
		const response = await page.evaluate(
			async (url, method, body) => {
				const res = await fetch(url, {
					method: method,
					headers: {
						'Content-Type': 'application/json',
						// Puppeteer automatically includes cookies, so session authentication should work.
						// If specific auth tokens (like Bearer tokens) are needed in headers, add them here.
						// e.g., 'Authorization': 'Bearer YOUR_TOKEN_IF_NEEDED'
					},
					body: JSON.stringify(body),
				});
				if (!res.ok) {
					// Try to get more detailed error info
					const errorText = await res.text();
					console.error(
						`API request to ${url} failed with status ${res.status}. Response: ${errorText.substring(0, 500)}`
					);
					throw new Error(`API request failed: ${res.status} - ${errorText.substring(0, 100)}`);
				}
				return res.json();
			},
			apiUrl,
			'POST', // Assuming it's a POST request. Change to 'GET' if needed and adjust payload handling.
			payload // Send the main payload: { chatId, offset, limit }
		);
		return response; // Expecting an array of log entries directly from GetChatLogs
	} catch (error) {
		console.error(
			`  Error during API call for ${characterName}, offset ${(payload as any).offset}:`,
			error
		);
		return []; // Return an empty array to indicate failure for this batch, allowing processing to continue or stop.
	}
}

function extractChatIdFromUrl(url: string): string | null {
	const match = url.match(/chat\/([a-f0-9-]+)/i);
	return match ? match[1] : null;
}

(async () => {
	let browser;
	try {
		console.log('Launching browser...');
		browser = await puppeteer.launch({
			headless: false, // Manual login requires browser UI
			// args: ['--user-data-dir=./puppeteer_user_data'] // Optional: to persist session somewhat between runs
		});
		const page = await browser.newPage();
		await page.setViewport({ width: 1366, height: 768 }); // A common viewport size

		console.log(`
------------------------------------------------------------------------------------
MANUAL LOGIN REQUIRED:
1. The script will now navigate to https://rofan.ai.
2. Please log in MANUALLY in the browser window that Puppeteer opens.
3. After you have successfully logged in and see your main dashboard/chat list,
   return to THIS CONSOLE WINDOW and press ENTER to continue crawling.
------------------------------------------------------------------------------------`);
		await page.goto('https://rofan.ai/', { waitUntil: 'networkidle2', timeout: 90000 });

		await new Promise<void>((resolve) => {
			process.stdin.once('data', () => resolve());
		});
		console.log('\nLogin complete (assumed by user). Proceeding with chat data crawling via API...');

		const resultDir = path.join(__dirname, 'result');
		await fs.mkdir(resultDir, { recursive: true });
		console.log(`Chat logs will be saved in: ${resultDir}`);

		if (!GET_CHAT_LOGS_API_URL || GET_CHAT_LOGS_API_URL.includes('YOUR_ACTUAL_API_ENDPOINT_HERE')) {
			console.error(
				'!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
			);
			console.error("CRITICAL: 'GET_CHAT_LOGS_API_URL' is not correctly configured in the script.");
			console.error(
				"Please update it with the actual API endpoint from your browser's Developer Tools."
			);
			console.error('The script will likely fail or not fetch any data without the correct API URL.');
			console.error(
				'!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
			);
			// Consider exiting if not configured: throw new Error("API URL not configured.");
		}

		for (const character of CHARACTERS) {
			const chatId = extractChatIdFromUrl(character.url);
			if (!chatId) {
				console.error(
					`\n[ERROR] Could not extract chatId for character: ${character.name} from URL: ${character.url}. Skipping.`
				);
				continue;
			}

			console.log(`\n--- Processing character: ${character.name} (Chat ID: ${chatId}) ---`);
			const allMessagesForThisCharacter: MigChatMessage[] = [];
			let currentOffset = 0;
			let moreMessagesExist = true;
			let apiRequestBatch = 0;

			while (moreMessagesExist) {
				apiRequestBatch++;
				const apiPayload = {
					chatId: chatId,
					offset: currentOffset,
					limit: API_FETCH_LIMIT,
					characterNameForLog: character.name, // For logging inside fetchChatLogsFromBrowser
					// Add any other fixed parameters the GetChatLogs API might require based on DevTools.
				};

				// The API response structure from your 'paste.txt' is an array of log objects.
				const logEntries: Array<RofanChatLog> = await fetchChatLogsFromBrowser(
					page,
					GET_CHAT_LOGS_API_URL,
					apiPayload
				);

				if (logEntries && logEntries.length > 0) {
					logEntries.forEach((logEntry) => {
						// The API might return entries that are one-sided (only user_chat or only bot_chat)
						// or combined. Your paste.txt shows them paired.
						if (logEntry.user_chat) {
							allMessagesForThisCharacter.push({
								role: 'user',
								content: logEntry.user_chat,
								timestamp: logEntry.updated,
								model: logEntry.model ?? '',
								uuid: logEntry.log_id,
							});
						}
						if (logEntry.bot_chat) {
							allMessagesForThisCharacter.push({
								role: 'assistant',
								content: logEntry.bot_chat,
								timestamp: logEntry.updated,
								model: logEntry.model,
								emotion: logEntry.emotion,
								uuid: logEntry.log_id, // Assuming log_id might be same if user/bot chat are part of one turn
							});
						}
					});

					currentOffset += API_FETCH_LIMIT; // Increment offset for the next batch

					if (logEntries.length < API_FETCH_LIMIT) {
						console.log(
							`  Fetched ${logEntries.length} messages, which is less than the limit (${API_FETCH_LIMIT}). Assuming end of logs for ${character.name}.`
						);
						moreMessagesExist = false;
					}
				} else {
					if (logEntries === null || logEntries.length === 0) {
						// Check for empty array specifically
						console.log(
							`  No more messages returned for offset ${currentOffset} for ${character.name} (or API call failed for this batch).`
						);
					}
					moreMessagesExist = false;
				}

				// Safety break to prevent potential infinite loops during development/testing
				if (apiRequestBatch > 500) {
					// Max 500 requests per character (e.g., 500 * 50 limit = 25,000 messages)
					console.warn(
						`  [WARN] Exceeded maximum API request limit (${apiRequestBatch} batches) for ${character.name}. Breaking to prevent infinite loop.`
					);
					moreMessagesExist = false;
				}

				if (moreMessagesExist) {
					// console.log(`    Waiting ${API_REQUEST_DELAY_MS}ms before next API call...`);
					await new Promise((resolve) => setTimeout(resolve, API_REQUEST_DELAY_MS));
				}
			}

			if (allMessagesForThisCharacter.length > 0) {
				// Sort messages by timestamp to ensure correct conversational order
				allMessagesForThisCharacter.sort(
					(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
				);

				const sanitizedCharacterName = character.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
				const filePath = path.join(resultDir, `${sanitizedCharacterName}_${randomUUID()}.json`);
				try {
					await fs.writeFile(filePath, JSON.stringify(allMessagesForThisCharacter, null, 2), 'utf8');
					console.log(
						`[SUCCESS] Saved ${allMessagesForThisCharacter.length} messages for ${character.name} to ${filePath}`
					);
				} catch (writeError) {
					console.error(
						`[ERROR] Failed to write chat log for ${character.name} to file ${filePath}:`,
						writeError
					);
				}
			} else {
				console.warn(
					`[WARN] No chat messages were fetched or parsed for ${character.name} (Chat ID: ${chatId}).`
				);
			}
		}
	} catch (error) {
		console.error('\nFATAL ERROR: An unhandled error occurred during the crawling process:', error);
	} finally {
		if (browser) {
			console.log('\nClosing browser...');
			await browser.close();
		}
		console.log('Crawler finished.');
		process.exit(0); // Explicitly exit to ensure script terminates
	}
})();
