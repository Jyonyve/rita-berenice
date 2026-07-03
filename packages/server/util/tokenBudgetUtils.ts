import { MODEL_LIMITS_INFO } from '@rita-berenice/shared/config';
import { AiModelInfo } from '@rita-berenice/shared/domain';

export interface TokenBudget {
	inputTokens: number;
	reservedOutputTokens: number;
	contextWindow: number;
	availableInputTokens: number;
}

export const buildTokenBudget = (inputTokens: number, aiInfo: AiModelInfo): TokenBudget | null => {
	const limits = MODEL_LIMITS_INFO[aiInfo.model];
	if (!limits) {
		return null;
	}

	const reservedOutputTokens = Math.min(aiInfo.maxTokens, limits.maxOutputTokens);
	return {
		inputTokens,
		reservedOutputTokens,
		contextWindow: limits.contextWindow,
		availableInputTokens: limits.contextWindow - reservedOutputTokens,
	};
};
