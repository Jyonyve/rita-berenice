import { createHash } from 'node:crypto';
import { CharacterInfo } from '@rita-berenice/shared/domain';
import { termStore } from '../store/termStore.js';
import { BackgroundJobQueue, BackgroundJobSnapshot } from '../util/backgroundJobQueue.js';
import { createOperationLogger, serializeError } from '../util/jsonlLogger.js';
import { llmService } from './llmService.js';

export interface CharacterGlossaryJobInput {
	characterId: string;
	userId: string;
	sourceText: string;
}

export interface CharacterGlossaryJobResult {
	characterId: string;
	extractedTermCount: number;
	resolvedTermCount: number;
}

export type CharacterGlossaryJobSnapshot = BackgroundJobSnapshot<CharacterGlossaryJobResult>;

type CharacterGlossaryWorker = (
	input: CharacterGlossaryJobInput
) => Promise<CharacterGlossaryJobResult>;

export const buildCharacterGlossarySource = (
	character: Pick<
		CharacterInfo,
		'name' | 'showName' | 'title' | 'worldIntroduction' | 'description' | 'instruction'
	>
): string =>
	[
		character.name,
		character.showName,
		character.title,
		character.worldIntroduction,
		character.description,
		character.instruction,
	]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join('\n\n');

const scanCharacterGlossary: CharacterGlossaryWorker = async (input) => {
	const extractedTerms = await llmService.extractGlossaryTerms(input.sourceText, input.userId);
	const resolvedTerms = await termStore.storeMissingCharacterTermMappings(
		input.characterId,
		extractedTerms
	);
	return {
		characterId: input.characterId,
		extractedTermCount: extractedTerms.length,
		resolvedTermCount: resolvedTerms.size,
	};
};

const buildJobId = (input: CharacterGlossaryJobInput): string =>
	`character-glossary:${input.characterId}:${createHash('sha256').update(input.sourceText).digest('hex')}`;

export const createCharacterGlossaryJobService = (
	worker: CharacterGlossaryWorker = scanCharacterGlossary
) => {
	const latestJobIdsByCharacter = new Map<string, string>();
	const queue = new BackgroundJobQueue<CharacterGlossaryJobInput, CharacterGlossaryJobResult>({
		worker: async (input) => {
			const jobId = buildJobId(input);
			const logger = createOperationLogger('characterGlossaryJobService', 'scanCharacter', {
				jobId,
				characterId: input.characterId,
				userId: input.userId,
				sourceLength: input.sourceText.length,
			});
			logger.info('start');
			try {
				const result = await worker(input);
				logger.complete({
					characterId: result.characterId,
					extractedTermCount: result.extractedTermCount,
					resolvedTermCount: result.resolvedTermCount,
				});
				return result;
			} catch (error) {
				logger.error('failed', serializeError(error));
				throw error;
			}
		},
		maxAttempts: 3,
		retryDelayMs: 500,
		maxRetainedJobs: 500,
	});

	return {
		enqueue(input: CharacterGlossaryJobInput): CharacterGlossaryJobSnapshot {
			const jobId = buildJobId(input);
			latestJobIdsByCharacter.set(input.characterId, jobId);
			return queue.enqueue(jobId, input);
		},

		get(characterId: string): CharacterGlossaryJobSnapshot | undefined {
			const jobId = latestJobIdsByCharacter.get(characterId);
			return jobId ? queue.get(jobId) : undefined;
		},
	};
};

export const characterGlossaryJobService = createCharacterGlossaryJobService();
