import { CollectionType, ChromaResponse } from '#shared/index.js';

/**
 * Handles errors caught in service methods.
 * If the error is already an ApiError, it's re-thrown.
 * Otherwise, it's logged and wrapped in a new ApiError with a 500 status.
 * @param caughtError The error object caught.
 * @param contextMessage A message providing context about the operation (e.g., "Failed to fetch user by ID").
 * @param clientMessage A generic client-facing message for 500 errors.
 */
export function handleServiceError(
	caughtError: any,
	contextMessage: string, // e.g., "Failed to get characters by showName '${showName}'"
	clientMessage: string = 'An internal server error occurred.' // Default client message for 500s
): never {
	// 'never' indicates this function always throws
	if (caughtError instanceof ApiError) {
		throw caughtError;
	}

	// Log the original error with context
	console.error(
		`Service Error - ${contextMessage}:`,
		caughtError.message,
		caughtError.stack || caughtError
	);

	// Throw a new ApiError, incorporating the original error's message for better internal logging
	throw new ApiError(
		500,
		`${contextMessage}: ${caughtError.message}`, // Developer-facing message
		clientMessage // Client-facing message
	);
}

// Your validation function, now as a type guard

// --- Validation Function (throws on error) ---
const _validateChromaResult = (
	response: any // Use 'any' for initial check, then guard
): response is ChromaResponse => {
	return (
		response !== null && // Should not be null if chromaDbClient throws for its own errors
		typeof response === 'object' &&
		Array.isArray(response.ids) &&
		Array.isArray(response.documents) && // These should be present even if empty
		Array.isArray(response.metadatas) // These should be present even if empty
	);
};

/**
 * Validates a ChromaResponse received by a service from chromaDbClient.
 * - Checks for structural integrity.
 * - For 'getOne' operations, throws ApiError(404) if no data is found (ids.length === 0).
 * @param chromaResponse The ChromaResponse from chromaDbClient.
 * @param operationType Distinguishes 'getOne' (expects data) from 'getList' (empty is OK).
 * @param collectionType Name of the resource for clearer error messages (e.g., "Character").
 * @returns The validated ChromaResponse.
 * @throws ApiError if validation fails.
 */
export const validateChromaResponse = (
	chromaResponse: ChromaResponse, // Assumes chromaDbClient now always returns this or throws its own Error
	operationType: 'getOne' | 'getList',
	collectionType: CollectionType
): ChromaResponse => {
	// 1. Structural Validation (Defense in depth)
	if (!_validateChromaResult(chromaResponse)) {
		// This case should be rare if chromaDbClient._returnResponse is robust
		console.error(
			`[validateAndProcessChromaResponse] Malformed ChromaResponse for ${collectionType}, operation ${operationType}:`,
			chromaResponse
		);
		throw new ApiError(
			500,
			`Unexpected data structure from database for ${collectionType}.`,
			`An internal error occurred while processing ${collectionType.toLowerCase()} data.`
		);
	}

	// 2. "Not Found" check for 'getOne' operations
	if (operationType === 'getOne' && chromaResponse.ids.length === 0) {
		throw new ApiError(
			404,
			`${collectionType} not found.`, // Developer message
			`The requested ${collectionType.toLowerCase()} does not exist.` // Client message
		);
	}

	// For 'getList' operations, chromaData.ids.length === 0 is a valid "empty list" scenario.
	// The service method will handle transforming this into an empty array of domain objects.

	return chromaResponse; // Data is structurally valid and (if 'getOne') not empty.
};

// In the same file as ApiError, e.g., src/server/util/errorHandlers.ts

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
// In src/server/util/errorHandlers.ts

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
