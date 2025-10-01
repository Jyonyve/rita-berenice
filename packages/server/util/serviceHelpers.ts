import { CollectionType } from '../db/ChromaInterfaces.js';
import { ChromaResponse } from '@rita-berenice/shared/api/ModuleResponse.js';
import { ApiError } from '@rita-berenice/shared/domain/error/errors.js';

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
	contextMessage: string,
	clientMessage: string = 'An internal server error occurred.',
	options: { suppress404?: boolean } = {}
): never {
	// Check if it's a 404 error that we've been asked to suppress
	if (options.suppress404 && caughtError instanceof ApiError && caughtError.status === 404) {
		// If so, just re-throw the original error without logging.
		// The client's interceptor will handle it gracefully.
		throw caughtError;
	}
	// 1. Log the error immediately with its context, regardless of type.
	// This ensures you always have visibility in your server logs.
	console.error(
		`Service Error - ${contextMessage}:`,
		// If it's an ApiError, its message is already descriptive. Otherwise, use the raw message.
		caughtError.message || caughtError,
		caughtError.stack || ''
	);

	// 2. If it's already a standardized ApiError, just re-throw it.
	if (caughtError instanceof ApiError) {
		throw caughtError;
	}

	// 3. For all other error types, wrap them in a generic 500 ApiError.
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
