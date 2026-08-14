interface ContinuityOptions<T> {
	getId: (item: T) => string;
	getSequence: (item: T) => number | undefined;
	excludedIds?: Iterable<string>;
	maxContinuations?: number;
}

export interface ContinuityExpansion<T> {
	items: T[];
	continuations: T[];
}

export const expandWithFollowingItems = <T>(
	anchors: T[],
	candidates: T[],
	options: ContinuityOptions<T>
): ContinuityExpansion<T> => {
	const maxContinuations = Math.max(options.maxContinuations ?? 4, 0);
	const excludedIds = new Set(options.excludedIds ?? []);
	const anchorIds = new Set(anchors.map(options.getId));
	const candidatesBySequence = new Map<number, T>();

	for (const candidate of candidates) {
		const sequence = options.getSequence(candidate);
		if (sequence !== undefined && !candidatesBySequence.has(sequence)) {
			candidatesBySequence.set(sequence, candidate);
		}
	}

	const items: T[] = [];
	const continuations: T[] = [];
	const seenIds = new Set<string>();

	for (const anchor of anchors) {
		const anchorId = options.getId(anchor);
		if (!excludedIds.has(anchorId) && !seenIds.has(anchorId)) {
			items.push(anchor);
			seenIds.add(anchorId);
		}

		if (continuations.length >= maxContinuations) continue;
		const sequence = options.getSequence(anchor);
		if (sequence === undefined) continue;

		const continuation = candidatesBySequence.get(sequence + 1);
		if (!continuation) continue;
		const continuationId = options.getId(continuation);
		if (
			excludedIds.has(continuationId) ||
			seenIds.has(continuationId) ||
			anchorIds.has(continuationId)
		) {
			continue;
		}

		items.push(continuation);
		continuations.push(continuation);
		seenIds.add(continuationId);
	}

	return { items, continuations };
};
