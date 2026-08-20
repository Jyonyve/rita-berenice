import { ApiError } from '@rita-berenice/shared/domain';
import { flowLogger, serializeError } from './jsonlLogger.js';

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
	flowLogger.error('serviceHelpers', 'service.error', {
		contextMessage,
		status: caughtError instanceof ApiError ? caughtError.status : undefined,
		...serializeError(caughtError),
	});

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

// In the same file as ApiError, e.g., src/server/util/errorHandlers.ts
