import { Where } from 'chromadb';

export function isAndWhere(where: Where): where is { $and: Where[] } {
	return where && '$and' in where && Array.isArray((where as any).$and);
}
