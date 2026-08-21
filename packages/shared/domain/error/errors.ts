import type { ApiKeyType } from '../credential/credential.type.js';

export class ApiError extends Error {
	public status: number;
	public clientMessage?: string;
	public details?: any; // Optional: for more detailed error info like missing fields

	constructor(status: number, message: string, clientMessage?: string, details?: any) {
		super(message); // Internal/developer message
		this.name = this.constructor.name;
		this.status = status;
		this.clientMessage = clientMessage;
		this.details = details;
		// `new.target`, not `ApiError`: hardcoding the base prototype here silently broke
		// `instanceof` for every subclass, since each one was rewritten back to ApiError.
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/**
 * A specific error for when an LLM's response cannot be parsed into the expected JSON format.
 * Extends ApiError to be handled correctly by the global error middleware.
 */
// In src/server/util/serviceHelpers.ts

export class LlmResponseParseError extends ApiError {
	public reason: 'NOT_FOUND' | 'MALFORMED_SYNTAX';

	constructor(
		reason: 'NOT_FOUND' | 'MALFORMED_SYNTAX',
		callerContext: string,
		rawResponse: string,
		clientMessage: string = "The AI's response was not in the expected format. Please try re-generating."
	) {
		const devMessage = `[${callerContext}] Failed to parse LLM response. Reason: ${reason}.`;
		super(
			502, // 502 Bad Gateway: Invalid response from upstream (LLM)
			devMessage,
			clientMessage,
			{ rawResponse: rawResponse.substring(0, 500) + '...' }
		);
		this.name = 'LlmResponseParseError';
		this.reason = reason;
	}
}

/**
 * The user cannot run this request because the API key it needs is absent or was refused
 * by the provider.
 *
 * This is deliberately distinct from a generic failure: it is the user's own configuration
 * problem, it is fixable in one step, and the client keys off `code` to point the user at
 * the right provider instead of showing "an unexpected error occurred".
 */
export type ApiKeyErrorReason = 'missing' | 'rejected';

export const API_KEY_ERROR_CODES = {
	missing: 'API_KEY_MISSING',
	rejected: 'API_KEY_REJECTED',
} as const;

export type ApiKeyErrorCode = (typeof API_KEY_ERROR_CODES)[ApiKeyErrorReason];

export const isApiKeyErrorCode = (value: unknown): value is ApiKeyErrorCode =>
	value === API_KEY_ERROR_CODES.missing || value === API_KEY_ERROR_CODES.rejected;

export class ApiKeyError extends ApiError {
	public readonly reason: ApiKeyErrorReason;
	public readonly code: ApiKeyErrorCode;
	public readonly keyType: ApiKeyType;

	constructor(reason: ApiKeyErrorReason, keyType: ApiKeyType, providerLabel: string) {
		const code = API_KEY_ERROR_CODES[reason];
		const devMessage =
			reason === 'missing'
				? `[llmService] No ${keyType} configured for this user.`
				: `[llmService] The configured ${keyType} was rejected by ${providerLabel}.`;
		const clientMessage =
			reason === 'missing'
				? `No ${providerLabel} API key is registered. Add one to start chatting.`
				: `The registered ${providerLabel} API key was rejected. Check or replace it.`;

		// 401 for a refused key, 400 for one that was never provided. Neither is a server fault.
		super(reason === 'missing' ? 400 : 401, devMessage, clientMessage, { code, keyType });
		this.name = 'ApiKeyError';
		this.reason = reason;
		this.code = code;
		this.keyType = keyType;
	}
}
