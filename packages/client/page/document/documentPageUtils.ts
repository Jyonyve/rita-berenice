import type { DocumentInfo } from '@rita-berenice/shared/domain';

export type DocumentRagFilter = 'all' | 'included' | 'notIncluded';

export const filterDocumentsByRagPreference = (
	documents: DocumentInfo[],
	filter: DocumentRagFilter
): DocumentInfo[] => {
	if (filter === 'all') return documents;
	const included = filter === 'included';
	return documents.filter((document) => Boolean(document.includeInRag) === included);
};
