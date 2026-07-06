import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as puppeteer from 'puppeteer';

const API_URL = 'https://rofan.ai/api/chat/GetChatLogs';
const EPISODES_API_URL = 'https://rofan.ai/api/chat/episode/GetEpisodes';
const DEFAULT_LIMIT = 100;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_RETRIES = 3;

type JsonObject = Record<string, unknown>;

interface PageManifest {
	file: string;
	offset: number;
	limit: number;
	recordCount: number;
	sha256: string;
	firstLogId: string | null;
	lastLogId: string | null;
	duplicateLogIds: string[];
	capturedAt: string;
}

interface Manifest {
	version: 1;
	apiUrl: string;
	chatId: string;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	pages: PageManifest[];
	totals: { rawRecords: number; uniqueLogIds: number; duplicateRecords: number };
}

interface Checkpoint {
	version: 1;
	chatId: string;
	nextOffset: number;
	completed: boolean;
	lastPageSha256: string | null;
	updatedAt: string;
}

interface FetchResult {
	status: number;
	statusText: string;
	contentType: string;
	body: string;
}

interface NormalizedEpisode {
	episode_id: string;
	title: unknown;
	summary: unknown;
	inherited: unknown;
	locked: unknown;
	additional_metadata: JsonObject;
	source: { page_file: string; offset: number; index_in_page: number };
}

export interface NormalizedChatLog {
	pk: unknown;
	log_id: string;
	chat_id: unknown;
	user_chat: unknown;
	bot_chat: unknown;
	created: unknown;
	updated: unknown;
	status: unknown;
	emotion: unknown;
	branch_metadata: JsonObject;
	additional_metadata: JsonObject;
	source: { page_file: string; offset: number; index_in_page: number };
}

function usage(): string {
	return [
		'Usage:',
		'  pnpm --filter @rita-berenice/migration rofan:extract -- --chat-id <id> [options]',
		'',
		'Options:',
		'  --output <dir>       Output root (default: rofan/data)',
		'  --limit <number>     API page size (default: 100)',
		'  --delay-ms <number>  Delay between pages (default: 500)',
		'  --retries <number>   Retries per request (default: 3)',
		'  --profile <dir>      Persistent Puppeteer browser profile',
		'  --headless           Run without a visible browser (requires an authenticated profile)',
		'  --login              Open rofan.ai and wait for manual login before extraction',
		'  --episodes           Also extract auto-generated episode summaries',
		'  --normalize-only     Rebuild JSONL from existing immutable pages without opening a browser',
	].join('\n');
}

function asPositiveInteger(value: string | undefined, name: string, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0)
		throw new Error(`--${name} must be a positive integer`);
	return parsed;
}

function asNonNegativeInteger(value: string | undefined, name: string, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0)
		throw new Error(`--${name} must be a non-negative integer`);
	return parsed;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRecords(body: string): JsonObject[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch (error) {
		throw new Error(`API response is not valid JSON: ${String(error)}`);
	}
	const envelopeKeys = ['data', 'records', 'episodes', 'chatLogs', 'result'] as const;
	let candidate: unknown[] | null = Array.isArray(parsed) ? parsed : null;
	if (candidate === null && isJsonObject(parsed)) {
		for (const key of envelopeKeys) {
			const value = parsed[key];
			if (Array.isArray(value)) {
				candidate = value;
				break;
			}
			if (isJsonObject(value)) {
				const nested = envelopeKeys.map((nestedKey) => value[nestedKey]).find(Array.isArray);
				if (nested) {
					candidate = nested;
					break;
				}
			}
		}
	}
	if (!candidate) {
		const shape = isJsonObject(parsed)
			? `object keys: ${Object.keys(parsed).join(', ') || '(none)'}`
			: typeof parsed;
		throw new Error(`API response contains no record array (${shape})`);
	}
	if (!candidate.every(isJsonObject)) throw new Error('API response contains a non-object record');
	return candidate;
}

function responseHasMore(body: string): boolean | null {
	const parsed: unknown = JSON.parse(body);
	if (!isJsonObject(parsed)) return null;
	if (typeof parsed.hasMore === 'boolean') return parsed.hasMore;
	for (const key of ['data', 'result']) {
		const nested = parsed[key];
		if (isJsonObject(nested) && typeof nested.hasMore === 'boolean') return nested.hasMore;
	}
	return null;
}

function getLogId(record: JsonObject, location: string): string {
	if (typeof record.log_id !== 'string' || record.log_id.trim() === '') {
		throw new Error(`${location} has no non-empty string log_id`);
	}
	return record.log_id;
}

function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function pageFileName(offset: number): string {
	return `page-${String(offset).padStart(10, '0')}.json`;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function renameWithRetry(sourcePath: string, destinationPath: string): Promise<void> {
	const retryableCodes = new Set(['EACCES', 'EBUSY', 'EPERM']);
	for (let attempt = 0; ; attempt += 1) {
		try {
			await fs.rename(sourcePath, destinationPath);
			return;
		} catch (error) {
			const code = isJsonObject(error) && typeof error.code === 'string' ? error.code : null;
			if (!code || !retryableCodes.has(code) || attempt >= 9) throw error;
			await new Promise((resolve) => setTimeout(resolve, Math.min(50 * 2 ** attempt, 1000)));
		}
	}
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
	const tempPath = `${filePath}.${process.pid}.tmp`;
	await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	await renameWithRetry(tempPath, filePath);
}

async function writeRawExclusive(filePath: string, body: string): Promise<void> {
	const handle = await fs.open(filePath, 'wx');
	try {
		await handle.writeFile(body, 'utf8');
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function createManifest(chatId: string): Manifest {
	const now = new Date().toISOString();
	return {
		version: 1,
		apiUrl: API_URL,
		chatId,
		createdAt: now,
		updatedAt: now,
		completedAt: null,
		pages: [],
		totals: { rawRecords: 0, uniqueLogIds: 0, duplicateRecords: 0 },
	};
}

async function readManifest(filePath: string, chatId: string): Promise<Manifest> {
	if (!(await pathExists(filePath))) return createManifest(chatId);
	const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Manifest;
	if (parsed.version !== 1 || parsed.chatId !== chatId || !Array.isArray(parsed.pages)) {
		throw new Error(`Manifest ${filePath} is incompatible with chat ${chatId}`);
	}
	return parsed;
}

function inspectPage(
	body: string,
	file: string,
	offset: number,
	limit: number,
	capturedAt: string
): PageManifest {
	const records = parseRecords(body);
	if (records.length > limit)
		throw new Error(`${file} returned ${records.length} records, exceeding limit ${limit}`);
	const ids = records.map((record, index) => getLogId(record, `${file} record ${index}`));
	const seen = new Set<string>();
	const duplicates = [...new Set(ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))];
	return {
		file,
		offset,
		limit,
		recordCount: records.length,
		sha256: sha256(body),
		firstLogId: ids[0] ?? null,
		lastLogId: ids.at(-1) ?? null,
		duplicateLogIds: duplicates,
		capturedAt,
	};
}

function validatePageSequence(pages: PageManifest[]): void {
	const sorted = [...pages].sort((a, b) => a.offset - b.offset);
	let expectedOffset = 0;
	const hashes = new Set<string>();
	for (const [index, page] of sorted.entries()) {
		if (page.offset !== expectedOffset) {
			throw new Error(
				`Pagination gap or overlap: expected offset ${expectedOffset}, found ${page.offset}`
			);
		}
		if (page.recordCount === 0 && index !== sorted.length - 1) {
			throw new Error(`Empty page at offset ${page.offset} is not the final page`);
		}
		if (page.recordCount > 0 && hashes.has(page.sha256)) {
			throw new Error(`Repeated page content at offset ${page.offset}; refusing a pagination loop`);
		}
		hashes.add(page.sha256);
		expectedOffset += page.recordCount;
	}
}

async function verifyManifestPages(runDir: string, manifest: Manifest): Promise<void> {
	for (const page of manifest.pages) {
		const body = await fs.readFile(path.join(runDir, page.file), 'utf8');
		if (sha256(body) !== page.sha256)
			throw new Error(`Immutable raw page checksum mismatch: ${page.file}`);
		const inspected = inspectPage(body, page.file, page.offset, page.limit, page.capturedAt);
		if (inspected.recordCount !== page.recordCount)
			throw new Error(`Manifest count mismatch: ${page.file}`);
	}
	validatePageSequence(manifest.pages);
}

function branchMetadata(record: JsonObject): JsonObject {
	return Object.fromEntries(
		Object.entries(record).filter(([key]) => /branch|parent|root|fork/i.test(key))
	);
}

export function normalizeRecord(
	record: JsonObject,
	page: Pick<PageManifest, 'file' | 'offset'>,
	indexInPage: number
): NormalizedChatLog {
	const known = new Set([
		'pk',
		'log_id',
		'chat_id',
		'user_chat',
		'bot_chat',
		'created',
		'updated',
		'created_at',
		'updated_at',
		'status',
		'emotion',
	]);
	const branch = branchMetadata(record);
	const additional = Object.fromEntries(
		Object.entries(record).filter(([key]) => !known.has(key) && !(key in branch))
	);
	return {
		pk: record.pk ?? null,
		log_id: getLogId(record, `${page.file} record ${indexInPage}`),
		chat_id: record.chat_id ?? null,
		user_chat: record.user_chat ?? null,
		bot_chat: record.bot_chat ?? null,
		created: record.created ?? record.created_at ?? null,
		updated: record.updated ?? record.updated_at ?? null,
		status: record.status ?? null,
		emotion: record.emotion ?? null,
		branch_metadata: branch,
		additional_metadata: additional,
		source: { page_file: page.file, offset: page.offset, index_in_page: indexInPage },
	};
}

async function generateNormalizedJsonl(runDir: string, manifest: Manifest): Promise<void> {
	const normalizedPath = path.join(runDir, 'normalized.jsonl');
	const tempPath = `${normalizedPath}.${process.pid}.tmp`;
	const seen = new Set<string>();
	let rawRecords = 0;
	let duplicateRecords = 0;
	const normalizedRecords: NormalizedChatLog[] = [];
	for (const page of [...manifest.pages].sort((a, b) => a.offset - b.offset)) {
		const records = parseRecords(await fs.readFile(path.join(runDir, page.file), 'utf8'));
		records.forEach((record, index) => {
			rawRecords += 1;
			const normalized = normalizeRecord(record, page, index);
			if (seen.has(normalized.log_id)) {
				duplicateRecords += 1;
				return;
			}
			seen.add(normalized.log_id);
			normalizedRecords.push(normalized);
		});
	}
	normalizedRecords.sort((left, right) => {
		const leftTime =
			typeof left.created === 'string' ? Date.parse(left.created) : Number.POSITIVE_INFINITY;
		const rightTime =
			typeof right.created === 'string' ? Date.parse(right.created) : Number.POSITIVE_INFINITY;
		const safeLeftTime = Number.isNaN(leftTime) ? Number.POSITIVE_INFINITY : leftTime;
		const safeRightTime = Number.isNaN(rightTime) ? Number.POSITIVE_INFINITY : rightTime;
		return safeLeftTime - safeRightTime || left.log_id.localeCompare(right.log_id);
	});
	const lines = normalizedRecords.map((record) => JSON.stringify(record));
	await fs.writeFile(tempPath, lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'utf8');
	await renameWithRetry(tempPath, normalizedPath);
	manifest.totals = { rawRecords, uniqueLogIds: seen.size, duplicateRecords };
	manifest.updatedAt = new Date().toISOString();
}

async function waitForLogin(page: puppeteer.Page): Promise<void> {
	await page.goto('https://rofan.ai/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
	console.log('Browser authentication is required. Log in to rofan.ai, then press Enter here.');
	await new Promise<void>((resolve) =>
		process.stdin.once('data', () => {
			process.stdin.pause();
			resolve();
		})
	);
}

async function fetchApiPage(
	page: puppeteer.Page,
	apiUrl: string,
	payload: JsonObject,
	retries: number
): Promise<FetchResult> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
		try {
			const result = await page.evaluate(
				async (url, payload) => {
					const response = await fetch(url, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
					});
					return {
						status: response.status,
						statusText: response.statusText,
						contentType: response.headers.get('content-type') ?? '',
						body: await response.text(),
					};
				},
				apiUrl,
				payload
			);
			if (result.status === 401 || result.status === 403)
				throw new Error(`AUTH_REQUIRED:${result.status}`);
			if (result.status < 200 || result.status >= 300) {
				throw new Error(`HTTP ${result.status} ${result.statusText}: ${result.body.slice(0, 300)}`);
			}
			parseRecords(result.body);
			return result;
		} catch (error) {
			lastError = error;
			if (String(error).includes('AUTH_REQUIRED:')) throw error;
			if (attempt <= retries) {
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 10_000))
				);
			}
		}
	}
	throw new Error(`Request failed after ${retries + 1} attempts: ${String(lastError)}`);
}

function getEpisodeId(record: JsonObject, location: string): string {
	if (
		(typeof record.episode_id !== 'string' && typeof record.episode_id !== 'number') ||
		String(record.episode_id).trim() === ''
	) {
		throw new Error(`${location} has no episode_id`);
	}
	return String(record.episode_id);
}

async function verifyEpisodeManifestPages(episodeDir: string, manifest: Manifest): Promise<void> {
	for (const page of manifest.pages) {
		const body = await fs.readFile(path.join(episodeDir, page.file), 'utf8');
		if (sha256(body) !== page.sha256)
			throw new Error(`Immutable episode checksum mismatch: ${page.file}`);
		const records = parseRecords(body);
		if (records.length !== page.recordCount)
			throw new Error(`Episode manifest count mismatch: ${page.file}`);
		records.forEach((record, index) => getEpisodeId(record, `${page.file} record ${index}`));
	}
	validatePageSequence(manifest.pages);
}

async function writeNormalizedEpisodes(episodeDir: string, manifest: Manifest): Promise<void> {
	const unique = new Map<string, NormalizedEpisode>();
	let rawRecords = 0;
	for (const page of [...manifest.pages].sort((left, right) => left.offset - right.offset)) {
		const records = parseRecords(await fs.readFile(path.join(episodeDir, page.file), 'utf8'));
		records.forEach((record, index) => {
			rawRecords += 1;
			const id = getEpisodeId(record, `${page.file} record ${index}`);
			if (unique.has(id)) return;
			const known = new Set(['episode_id', 'title', 'summary', 'inherited', 'locked']);
			unique.set(id, {
				episode_id: id,
				title: record.title ?? null,
				summary: record.summary ?? null,
				inherited: record.inherited ?? null,
				locked: record.locked ?? null,
				additional_metadata: Object.fromEntries(
					Object.entries(record).filter(([key]) => !known.has(key))
				),
				source: { page_file: page.file, offset: page.offset, index_in_page: index },
			});
		});
	}
	const normalized = [...unique.values()].sort((left, right) =>
		left.episode_id.localeCompare(right.episode_id, 'en', { numeric: true })
	);
	const normalizedPath = path.join(episodeDir, 'normalized.jsonl');
	const tempPath = `${normalizedPath}.${process.pid}.tmp`;
	await fs.writeFile(
		tempPath,
		normalized.length === 0
			? ''
			: `${normalized.map((record) => JSON.stringify(record)).join('\n')}\n`,
		'utf8'
	);
	await renameWithRetry(tempPath, normalizedPath);
	manifest.totals = {
		rawRecords,
		uniqueLogIds: unique.size,
		duplicateRecords: rawRecords - unique.size,
	};
	manifest.updatedAt = new Date().toISOString();
}

async function extractEpisodes(
	page: puppeteer.Page,
	runDir: string,
	chatId: string,
	limit: number,
	delayMs: number,
	retries: number
): Promise<void> {
	const episodeLimit = Math.min(limit, 20);
	const episodeDir = path.join(runDir, 'episodes');
	const rawDir = path.join(episodeDir, 'raw');
	const manifestPath = path.join(episodeDir, 'manifest.json');
	const checkpointPath = path.join(episodeDir, 'checkpoint.json');
	await fs.mkdir(rawDir, { recursive: true });
	const manifest = await readManifest(manifestPath, chatId);
	manifest.apiUrl = EPISODES_API_URL;
	await verifyEpisodeManifestPages(episodeDir, manifest);
	let offset = manifest.pages.reduce((sum, item) => sum + item.recordCount, 0);
	let completed = manifest.completedAt !== null;

	while (!completed) {
		const relativeFile = path.join('raw', pageFileName(offset)).replaceAll('\\', '/');
		const rawPath = path.join(episodeDir, relativeFile);
		let body: string;
		let capturedAt: string;
		if (await pathExists(rawPath)) {
			body = await fs.readFile(rawPath, 'utf8');
			capturedAt = (await fs.stat(rawPath)).birthtime.toISOString();
			console.log(`Adopting existing episode page at offset ${offset}`);
		} else {
			console.log(`Fetching episodes offset ${offset}, limit ${episodeLimit}`);
			const response = await fetchApiPage(
				page,
				EPISODES_API_URL,
				{ chatId, offset, limit: episodeLimit, sort: 'newest' },
				retries
			);
			body = response.body;
			capturedAt = new Date().toISOString();
			await writeRawExclusive(rawPath, body);
		}
		const records = parseRecords(body);
		if (records.length > episodeLimit)
			throw new Error(`${relativeFile} exceeds episode limit ${episodeLimit}`);
		const ids = records.map((record, index) =>
			getEpisodeId(record, `${relativeFile} record ${index}`)
		);
		const seen = new Set<string>();
		const pageManifest: PageManifest = {
			file: relativeFile,
			offset,
			limit: episodeLimit,
			recordCount: records.length,
			sha256: sha256(body),
			firstLogId: ids[0] ?? null,
			lastLogId: ids.at(-1) ?? null,
			duplicateLogIds: [...new Set(ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))],
			capturedAt,
		};
		manifest.pages.push(pageManifest);
		validatePageSequence(manifest.pages);
		offset += records.length;
		const hasMore = responseHasMore(body);
		completed = hasMore === null ? records.length < episodeLimit : !hasMore;
		if (hasMore === true && records.length === 0) {
			throw new Error(
				`Episode API reported hasMore=true but returned no records at offset ${pageManifest.offset}`
			);
		}
		if (completed) manifest.completedAt = new Date().toISOString();
		manifest.updatedAt = new Date().toISOString();
		await writeNormalizedEpisodes(episodeDir, manifest);
		await writeJsonAtomic(manifestPath, manifest);
		await writeJsonAtomic(checkpointPath, {
			version: 1,
			chatId,
			nextOffset: offset,
			completed,
			lastPageSha256: pageManifest.sha256,
			updatedAt: manifest.updatedAt,
		} satisfies Checkpoint);
		if (!completed && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	await writeNormalizedEpisodes(episodeDir, manifest);
	await writeJsonAtomic(manifestPath, manifest);
	console.log(`Episodes complete: ${manifest.totals.uniqueLogIds} unique summaries`);
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		args: process.argv.slice(2).filter((argument) => argument !== '--'),
		options: {
			'chat-id': { type: 'string' },
			output: { type: 'string' },
			limit: { type: 'string' },
			'delay-ms': { type: 'string' },
			retries: { type: 'string' },
			profile: { type: 'string' },
			headless: { type: 'boolean', default: false },
			login: { type: 'boolean', default: false },
			episodes: { type: 'boolean', default: false },
			'normalize-only': { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false },
		},
		strict: true,
		allowPositionals: false,
	});
	if (values.help) {
		console.log(usage());
		return;
	}
	const chatId = values['chat-id']?.trim();
	if (!chatId) throw new Error(`Target chatId is required.\n\n${usage()}`);
	const limit = asPositiveInteger(values.limit, 'limit', DEFAULT_LIMIT);
	const delayMs = asNonNegativeInteger(values['delay-ms'], 'delay-ms', DEFAULT_DELAY_MS);
	const retries = asNonNegativeInteger(values.retries, 'retries', DEFAULT_RETRIES);
	const outputRoot = path.resolve(values.output ?? path.join('rofan', 'data'));
	const runDir = path.join(outputRoot, chatId);
	const rawDir = path.join(runDir, 'raw');
	const manifestPath = path.join(runDir, 'manifest.json');
	const checkpointPath = path.join(runDir, 'checkpoint.json');
	await fs.mkdir(rawDir, { recursive: true });
	const manifest = await readManifest(manifestPath, chatId);
	await verifyManifestPages(runDir, manifest);

	if (values['normalize-only']) {
		await generateNormalizedJsonl(runDir, manifest);
		await writeJsonAtomic(manifestPath, manifest);
		if (values.episodes) {
			const episodeDir = path.join(runDir, 'episodes');
			const episodeManifestPath = path.join(episodeDir, 'manifest.json');
			const episodeManifest = await readManifest(episodeManifestPath, chatId);
			await verifyEpisodeManifestPages(episodeDir, episodeManifest);
			await writeNormalizedEpisodes(episodeDir, episodeManifest);
			await writeJsonAtomic(episodeManifestPath, episodeManifest);
		}
		console.log(`Normalized ${manifest.totals.uniqueLogIds} unique records in ${runDir}`);
		return;
	}

	let browser: puppeteer.Browser | undefined;
	try {
		browser = await puppeteer.launch({
			headless: values.headless,
			userDataDir: values.profile ? path.resolve(values.profile) : undefined,
		});
		const pages = await browser.pages();
		const page = pages[0] ?? (await browser.newPage());
		if (values.login) await waitForLogin(page);
		else await page.goto('https://rofan.ai/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
		let offset = manifest.pages.reduce((sum, item) => sum + item.recordCount, 0);
		let completed = manifest.completedAt !== null;
		while (!completed) {
			const relativeFile = path.join('raw', pageFileName(offset)).replaceAll('\\', '/');
			const rawPath = path.join(runDir, relativeFile);
			let body: string;
			let capturedAt: string;
			if (await pathExists(rawPath)) {
				body = await fs.readFile(rawPath, 'utf8');
				capturedAt = (await fs.stat(rawPath)).birthtime.toISOString();
				console.log(`Adopting existing immutable page at offset ${offset}`);
			} else {
				console.log(`Fetching offset ${offset}, limit ${limit}`);
				let response: FetchResult;
				try {
					response = await fetchApiPage(page, API_URL, { chatId, offset, limit }, retries);
				} catch (error) {
					if (String(error).includes('AUTH_REQUIRED:')) {
						throw new Error(
							'Browser authentication is required. Re-run with --login or an authenticated --profile.'
						);
					}
					throw error;
				}
				body = response.body;
				capturedAt = new Date().toISOString();
				await writeRawExclusive(rawPath, body);
			}
			const pageManifest = inspectPage(body, relativeFile, offset, limit, capturedAt);
			if (manifest.pages.some((item) => item.offset === offset))
				throw new Error(`Duplicate offset ${offset}`);
			manifest.pages.push(pageManifest);
			validatePageSequence(manifest.pages);
			offset += pageManifest.recordCount;
			completed = pageManifest.recordCount < limit;
			if (completed) manifest.completedAt = new Date().toISOString();
			manifest.updatedAt = new Date().toISOString();
			const checkpoint: Checkpoint = {
				version: 1,
				chatId,
				nextOffset: offset,
				completed,
				lastPageSha256: pageManifest.sha256,
				updatedAt: manifest.updatedAt,
			};
			await generateNormalizedJsonl(runDir, manifest);
			await writeJsonAtomic(manifestPath, manifest);
			await writeJsonAtomic(checkpointPath, checkpoint);
			if (!completed && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		console.log(
			`Complete: ${manifest.totals.rawRecords} raw, ${manifest.totals.uniqueLogIds} unique, ${manifest.totals.duplicateRecords} duplicates`
		);
		if (values.episodes) await extractEpisodes(page, runDir, chatId, limit, delayMs, retries);
	} finally {
		await browser?.close();
	}
}

const isDirectExecution =
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
