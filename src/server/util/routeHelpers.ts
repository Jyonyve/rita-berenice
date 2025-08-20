// File: server/util/routeHelpers.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { CollectionType } from '../db/ChromaInterfaces.js';
import { convertArrayToString } from '#shared/util/parseUtils.js';
import { ApiError } from '#shared/domain/error/errors.js';
import { toKebabCase } from '#shared/util/apiHelpers.js';
import zlib from 'zlib';

/** Router part */
export type CustomValidationRule = {
	// Predicate function receives the data source. Return true if validation FAILS.
	predicate: (data: any) => boolean;
	status: number; // HTTP status for this validation error
	errorMessage: string; // Developer-facing error message
	clientMessage?: string; // Client-facing error message
	details?: any; // Additional details for the error responsed
};

export const asyncHandler = (
	fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

export const validateServiceId = (serviceId: string, collection: CollectionType) => {
	if (!serviceId)
		throw new ApiError(
			400,
			`valid ${collection === 'chat' ? 'session' : collection} ID is required.`
		);
};

/**
 * Validates a given data source (e.g., req.body, req.params, req.query).
 * Throws an ApiError if validation fails.
 *
 * @param dataSource The object to validate (req.body, req.params, req.query).
 * @param sourceName A string like 'body', 'params', or 'query' for error messages.
 * @param requiredFields An array of field names that must be present and non-empty in the dataSource.
 * @param customValidations An array of custom validation rules.
 */
export const validateRequestData = (
	dataSource: any,
	sourceName: 'body' | 'params' | 'query' | 'headers', // Added 'headers' for completeness
	requiredFields?: string[], // Changed from (keyof any)[] to string[] for broader compatibility
	customValidations?: CustomValidationRule[]
) => {
	// Check if the data source itself is an object (params and query are objects, body should be)
	if (!dataSource || typeof dataSource !== 'object') {
		throw new ApiError(
			400,
			`Invalid request ${sourceName}: Expected an object.`,
			`The request ${sourceName} is malformed.`
		);
	}

	// Check for required fields
	if (requiredFields) {
		const missing = requiredFields.filter(
			(field) =>
				!(field in dataSource) || // Field doesn't exist
				dataSource[field] === undefined ||
				dataSource[field] === null ||
				(typeof dataSource[field] === 'string' && dataSource[field].trim() === '') // Empty string considered missing
		);
		if (missing.length > 0) {
			throw new ApiError(
				400,
				`Missing required fields in request ${sourceName}: ${convertArrayToString(missing)}`,
				'Some required information is missing. Please fill in all fields.',
				{ source: sourceName, missing }
			);
		}
	}

	// Apply custom validations
	customValidations?.forEach((vld) => {
		if (vld.predicate(dataSource)) {
			// Pass dataSource to the predicate
			throw new ApiError(vld.status, vld.errorMessage, vld.clientMessage, vld.details);
		}
	});
};

export const validateSequenceRule = (
	seqParamName: string,
	options?: { status?: number; errorMessage?: string; clientMessage?: string; allowZero?: boolean }
): CustomValidationRule => {
	const allowZero = options?.allowZero ?? true;
	// --- This IS the CustomValidationRule object ---
	const sequenceCustomValidationRule: CustomValidationRule = {
		predicate: (dataSource: any) => {
			// dataSource is req.query, req.params, or req.body
			const value = dataSource[seqParamName]; // Access the field dynamically using its name
			if (typeof value !== 'string') return true; // Fails validation
			const num = parseInt(value, 10);
			if (isNaN(num)) return true; // Fails
			return allowZero ? num < 0 : num <= 0; // Fails if not in the allowed range
		},
		status: options?.status || 400,
		errorMessage:
			options?.errorMessage ||
			`Parameter '${seqParamName}' must be a string representing a ${allowZero ? 'non-negative' : 'positive'} integer.`,
		clientMessage:
			options?.clientMessage ||
			`A valid ${allowZero ? 'non-negative' : 'positive'} '${seqParamName}' number is required.`,
	};

	return sequenceCustomValidationRule;
};

/**
 * Generates an API URL pattern suitable for Express route definitions.
 * Includes parameter placeholders like /:paramName based on the method name convention.
 * Assumes parameters follow the method name in the URL structure.
 *
 * @param moduleName - The resource name (e.g., 'chroma', 'character', 'chat'). Should be singular.
 * @param methodName - The operation being performed (e.g., 'storeChatTurn', 'getSummary').
 * @param paramNames - Optional array of parameter names to append as placeholders (e.g., ['sessionId', 'sequence']).
 * @returns The API route pattern string (e.g., '/api/chroma/store-chat-turn/:sessionId').
 */
export function genRoutePattern(
	// moduleName is no longer part of the generated path string
	methodName: string,
	paramNames: string[] = []
): string {
	const kebabMethod = toKebabCase(methodName);
	// Start the path directly with the method name, relative to the mount point
	let path = `/${kebabMethod}`;

	// Append parameter placeholders if any are specified
	if (paramNames.length > 0) {
		const paramPlaceholders = paramNames.map((name) => `:${name}`).join('/');
		path += `/${paramPlaceholders}`;
	}

	return path;
}

export const compressData = (data: any): string => {
	const jsonPayload = JSON.stringify(data);
	const compressed = zlib.gzipSync(jsonPayload);
	return compressed.toString('base64');
};
