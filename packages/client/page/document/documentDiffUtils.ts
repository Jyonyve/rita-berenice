export type DocumentDiffLine = {
  kind: 'unchanged' | 'removed' | 'added';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

type DocumentRequestComparison = { documentId: string; instruction: string };

export const resolveLastDocumentRequest = (
  selectedDocumentId: string | undefined,
  selectedRequestText: string | undefined,
  comparison: DocumentRequestComparison | undefined,
): string | undefined =>
  comparison && comparison.documentId === selectedDocumentId ? comparison.instruction : selectedRequestText;

const MAX_DETAILED_LINES = 600;

const withLineNumbers = (lines: Array<Pick<DocumentDiffLine, 'kind' | 'text'>>): DocumentDiffLine[] => {
  let oldLineNumber = 0;
  let newLineNumber = 0;
  return lines.map((line) => {
    if (line.kind !== 'added') oldLineNumber += 1;
    if (line.kind !== 'removed') newLineNumber += 1;
    return {
      ...line,
      ...(line.kind !== 'added' ? { oldLineNumber } : {}),
      ...(line.kind !== 'removed' ? { newLineNumber } : {}),
    };
  });
};

const fallbackDiff = (before: string[], after: string[]): DocumentDiffLine[] => {
  let prefixLength = 0;
  while (prefixLength < before.length && prefixLength < after.length && before[prefixLength] === after[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < before.length - prefixLength &&
    suffixLength < after.length - prefixLength &&
    before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return withLineNumbers([
    ...before.slice(0, prefixLength).map((text) => ({ kind: 'unchanged' as const, text })),
    ...before.slice(prefixLength, before.length - suffixLength).map((text) => ({ kind: 'removed' as const, text })),
    ...after.slice(prefixLength, after.length - suffixLength).map((text) => ({ kind: 'added' as const, text })),
    ...before.slice(before.length - suffixLength).map((text) => ({ kind: 'unchanged' as const, text })),
  ]);
};

export const diffDocumentLines = (beforeText: string, afterText: string): DocumentDiffLine[] => {
  const before = beforeText.split('\n');
  const after = afterText.split('\n');
  if (before.length + after.length > MAX_DETAILED_LINES) return fallbackDiff(before, after);

  const trace: Array<Map<number, number>> = [];
  const frontier = new Map<number, number>([[1, 0]]);
  const maxDistance = before.length + after.length;

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
      const right = frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
      let oldIndex =
        diagonal === -distance || (diagonal !== distance && right < down) ? Math.max(0, down) : Math.max(0, right + 1);
      let newIndex = oldIndex - diagonal;

      while (oldIndex < before.length && newIndex < after.length && before[oldIndex] === after[newIndex]) {
        oldIndex += 1;
        newIndex += 1;
      }
      frontier.set(diagonal, oldIndex);

      if (oldIndex < before.length || newIndex < after.length) continue;

      const reversed: Array<Pick<DocumentDiffLine, 'kind' | 'text'>> = [];
      let backtrackOld = before.length;
      let backtrackNew = after.length;
      for (let step = trace.length - 1; step >= 0; step -= 1) {
        const previous = trace[step];
        const currentDiagonal = backtrackOld - backtrackNew;
        const previousDown = previous.get(currentDiagonal + 1) ?? Number.NEGATIVE_INFINITY;
        const previousRight = previous.get(currentDiagonal - 1) ?? Number.NEGATIVE_INFINITY;
        const previousDiagonal =
          currentDiagonal === -step || (currentDiagonal !== step && previousRight < previousDown)
            ? currentDiagonal + 1
            : currentDiagonal - 1;
        const previousOld = Math.max(0, previous.get(previousDiagonal) ?? 0);
        const previousNew = previousOld - previousDiagonal;

        while (backtrackOld > previousOld && backtrackNew > previousNew) {
          reversed.push({ kind: 'unchanged', text: before[backtrackOld - 1] });
          backtrackOld -= 1;
          backtrackNew -= 1;
        }
        if (step === 0) break;
        if (backtrackOld === previousOld) {
          reversed.push({ kind: 'added', text: after[backtrackNew - 1] });
          backtrackNew -= 1;
        } else {
          reversed.push({ kind: 'removed', text: before[backtrackOld - 1] });
          backtrackOld -= 1;
        }
      }
      return withLineNumbers(reversed.reverse());
    }
  }

  return fallbackDiff(before, after);
};
