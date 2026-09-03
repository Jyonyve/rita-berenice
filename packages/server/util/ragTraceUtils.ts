import { randomUUID } from 'node:crypto';
import { flowLogger } from './jsonlLogger.js';

export interface RagTraceContext {
  traceId: string;
  sessionId: string;
  userId: string;
  characterId: string;
  turnId?: string;
  sequence?: number;
}

type RagTraceEnvironment = Record<string, string | undefined>;
type TraceData = Record<string, unknown>;

const OMITTED_TRACE_KEYS = new Set([
  'content',
  'document',
  'documents',
  'memoryChunk',
  'prompt',
  'request',
  'response',
]);

export const isRagTraceEnabled = (environment: RagTraceEnvironment = process.env): boolean =>
  (environment.NODE_ENV ?? 'development') === 'development' && environment.RITA_RAG_TRACE === 'true';

const sanitizeTraceValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeTraceValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as TraceData)
      .filter(([key]) => !OMITTED_TRACE_KEYS.has(key))
      .map(([key, nestedValue]) => [key, sanitizeTraceValue(nestedValue)]),
  );
};

export const createRagTraceContext = (context: Omit<RagTraceContext, 'traceId'>): RagTraceContext => ({
  traceId: randomUUID(),
  ...context,
});

export const traceRagEvent = (
  context: RagTraceContext,
  event: string,
  data: TraceData = {},
  environment: RagTraceEnvironment = process.env,
): void => {
  if (!isRagTraceEnabled(environment)) return;
  flowLogger.debug('ragTrace', event, { ...context, ...(sanitizeTraceValue(data) as TraceData) });
};
