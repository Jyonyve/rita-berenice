import { CollectionType } from '#root/src/shared/index.ts';
import { GetResponse } from 'chromadb';
import { ChromaResponse } from '../db/index.ts';

export const validateServiceId = (serviceId: string, collection: CollectionType) => {
	if (!serviceId)
		throw new Error(`valid ${collection === 'chat' ? 'session' : collection} ID is required.`);
};

// Your validation function, now as a type guard
export const validateResult = (
	response: Partial<GetResponse> | null // The potentially incomplete or null response
): response is ChromaResponse => {
	// Type predicate
	return (
		response !== null &&
		typeof response === 'object' && // Basic object check
		Array.isArray(response.ids) &&
		response.ids.length > 0 &&
		Array.isArray(response.documents) && // Check if documents array exists
		Array.isArray(response.metadatas) // Check if metadatas array exists
		// You might add more checks, e.g., ensuring lengths match if required
		// && response.documents.length === response.ids.length
		// && response.metadatas.length === response.ids.length
	);
};
