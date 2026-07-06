import { EnqueueFinalizationResponse, FinalizationJobSnapshot } from '@rita-berenice/shared/api';
import { ChatTurn, ChatTurnCdo, DisplayTurn } from '@rita-berenice/shared/domain';
import { buildChatTurnId, createBasicChatTurn } from '@rita-berenice/shared/util';
import { chatStore } from '../store/chatStore.js';
import { BackgroundJobQueue } from '../util/backgroundJobQueue.js';
import { enrichChatTurn } from './orchestrationService.js';

const enrichedTurnCache = new Map<string, ChatTurn>();
const finalizationQueue = new BackgroundJobQueue<ChatTurnCdo, ChatTurn>({
	worker: async (chatTurnCdo) => {
		const chatTurnId = buildChatTurnId(chatTurnCdo.sessionId, chatTurnCdo.sequence);
		let enrichedTurn = enrichedTurnCache.get(chatTurnId);
		if (!enrichedTurn) {
			enrichedTurn = await enrichChatTurn(chatTurnCdo);
			if (enrichedTurnCache.size >= 500) {
				const oldestKey = enrichedTurnCache.keys().next().value;
				if (oldestKey) enrichedTurnCache.delete(oldestKey);
			}
			enrichedTurnCache.set(chatTurnId, enrichedTurn);
		}

		await chatStore.storeChatTurn(enrichedTurn);
		enrichedTurnCache.delete(chatTurnId);
		return enrichedTurn;
	},
	maxAttempts: 3,
	retryDelayMs: 500,
	maxRetainedJobs: 500,
});

const toDisplayTurn = (turn: ChatTurn): DisplayTurn => ({
	chatTurnId: turn.chatTurnId,
	sessionId: turn.sessionId,
	characterId: turn.characterId,
	userId: turn.userId,
	profileId: turn.profileId,
	sequence: turn.sequence,
	createdAt: turn.createdAt,
	updatedAt: turn.updatedAt,
	request: turn.request,
	response: turn.response,
});

const findFinalizedTurn = async (chatTurnId: string): Promise<ChatTurn | undefined> => {
	if (!(await chatStore.hasChatTurn(chatTurnId))) return undefined;
	const response = await chatStore.getChatTurn(chatTurnId);
	return response.chatTurns[0];
};

export const finalizationJobService = {
	async enqueue(chatTurnCdo: ChatTurnCdo): Promise<EnqueueFinalizationResponse> {
		const basicTurn = createBasicChatTurn(chatTurnCdo);
		const existingJob = finalizationQueue.get(basicTurn.chatTurnId);
		if (existingJob && existingJob.status !== 'failed') {
			return { job: existingJob, displayTurn: toDisplayTurn(existingJob.result ?? basicTurn) };
		}

		const finalizedTurn = await findFinalizedTurn(basicTurn.chatTurnId);
		const job = finalizedTurn
			? finalizationQueue.recordCompleted(basicTurn.chatTurnId, chatTurnCdo, finalizedTurn)
			: finalizationQueue.enqueue(basicTurn.chatTurnId, chatTurnCdo);

		return { job, displayTurn: toDisplayTurn(finalizedTurn ?? basicTurn) };
	},

	async get(sessionId: string, sequence: number): Promise<FinalizationJobSnapshot | undefined> {
		const jobId = buildChatTurnId(sessionId, sequence);
		const existingJob = finalizationQueue.get(jobId);
		if (existingJob) return existingJob;

		const finalizedTurn = await findFinalizedTurn(jobId);
		if (!finalizedTurn) return undefined;

		return {
			jobId,
			status: 'completed',
			attempts: 0,
			maxAttempts: 3,
			createdAt: finalizedTurn.createdAt,
			updatedAt: finalizedTurn.updatedAt,
			result: finalizedTurn,
		};
	},
};
