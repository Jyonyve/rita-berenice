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
		Object.setPrototypeOf(this, ApiError.prototype);
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
