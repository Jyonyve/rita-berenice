// src/client/hooks/useOrchestrationApi.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient, consumeNdjsonStream, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { ChatTurn, ChatTurnCdo, TempChatTurn } from '@rita-berenice/shared/domain';
import {
	ChatGenerationStage,
	EnqueueFinalizationResponse,
	FinalizationJobSnapshot,
	ReceiveBotResponseRequest,
	ReceiveBotResponseStreamEvent,
} from '@rita-berenice/shared/api';
import { ApiError } from '@rita-berenice/shared/domain';

interface ReceiveBotResponseStreamVariables {
	request: ReceiveBotResponseRequest;
	onDelta?: (text: string) => void;
	onStatus?: (stage: ChatGenerationStage) => void;
	signal?: AbortSignal;
}

interface EnqueueFinalizationVariables {
	cdo: ChatTurnCdo;
	signal?: AbortSignal;
}

/**
 * A client-side hook for interacting with the main ORCHESTRATION API endpoint,
 * refactored for TanStack Query.
 */
export const useOrchestrationApi = () => {
	const MODULE_NAME = MODULE_NAMES.ORCHESTRATION;

	const enqueueFinalization = useMutation<
		EnqueueFinalizationResponse,
		Error,
		EnqueueFinalizationVariables
	>({
		mutationFn: async ({ cdo, signal }) => {
			const url = genApiUrl(MODULE_NAMES.ORCHESTRATION, 'enqueueFinalization');
			const response = await apiClient.post<EnqueueFinalizationResponse>(url, cdo, { signal });
			return response.data;
		},
	});

	const waitForFinalizationJob = async (
		sessionId: string,
		sequence: number,
		signal?: AbortSignal
	): Promise<ChatTurn> => {
		const url = genApiUrl(MODULE_NAMES.ORCHESTRATION, 'getFinalizationJob', [sessionId, sequence]);

		while (!signal?.aborted) {
			const response = await apiClient.get<FinalizationJobSnapshot>(url, { signal });
			if (response.data.status === 'completed' && response.data.result) {
				return response.data.result;
			}
			if (response.data.status === 'failed') {
				throw new ApiError(
					500,
					response.data.error || 'Chat turn finalization failed.',
					'The message was saved locally, but memory indexing failed.'
				);
			}
			await new Promise((resolve) => setTimeout(resolve, 1_000));
		}

		throw new DOMException('Finalization status polling was aborted.', 'AbortError');
	};

	/**
	 * Orchestrates the backend flow for generating a new character response.
	 * This is a mutation as it creates a new chat turn (even temporary).
	 * Mutation key: 'receiveBotResponse'
	 */
	const receiveBotResponse = useMutation<
		TempChatTurn, // Return type on success
		Error, // Error type
		ReceiveBotResponseStreamVariables
	>({
		mutationFn: async ({ request, onDelta, onStatus, signal }) => {
			const url = genApiUrl(MODULE_NAME, 'receiveBotResponseStream');
			let completedTurn: TempChatTurn | undefined;

			await consumeNdjsonStream<ReceiveBotResponseStreamEvent>(
				url,
				request,
				(event) => {
					switch (event.type) {
						case 'status':
							onStatus?.(event.stage);
							break;
						case 'delta':
							onDelta?.(event.text);
							break;
						case 'complete':
							completedTurn = event.data;
							break;
						case 'error':
							// `details` carries the actionable-failure marker (missing/rejected API key)
							// so the caller can prompt for the key instead of only printing text.
							throw new ApiError(500, event.message, event.clientMessage, {
								code: event.code,
								keyType: event.keyType,
							});
					}
				},
				signal
			);

			if (!completedTurn) {
				throw new ApiError(502, 'The response stream ended before completion.');
			}
			return completedTurn;
		},
	});

	return { receiveBotResponse, enqueueFinalization, waitForFinalizationJob };
};
