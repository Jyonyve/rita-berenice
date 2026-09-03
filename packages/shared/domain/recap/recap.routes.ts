// src/shared/domain/recap/RecapInterfaces.ts (or your equivalent file)

import { METADATA_TYPES } from '../../config/index.js';
import { Reference } from '../BaseTypes.js';
import { z } from 'zod';

export type RecapIndexContentType = 'RECAP_FLAG';

// --- 1. The Primary Document Metadata ---
/**
 * Metadata for a primary RECAP or RELATIONSHIP document stored in the vector store.
 * This document contains the main content for semantic search.
 * All array-like fields intended for filtering have been removed.
 */
export interface RecapMetadata {
  type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;
  recapId: string;
  sessionId: string;
  characterId: string;
  userId: string;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  turnStart: number;
  turnEnd: number;
  model: string;
  loreReferenceList: string;
  historyReferenceList: string;
}

// --- 2. The Search Index Metadata ---
/**
 * A dedicated metadata structure for Recap-related search index entries.
 * A new record of this type is created for every single flag associated with a Recap.
 */
export interface RecapIndexMetadata {
  // The type of the parent document
  type: typeof METADATA_TYPES.INDEX;

  // What kind of attribute this index entry represents
  contentType: RecapIndexContentType;

  // Foreign key to the parent Recap document
  recapId: string;

  // The indexed value (e.g., "major_plot_point")
  value: string;

  // Core identifiers for broad filtering
  sessionId: string;
  characterId: string;
}

// --- 3. The Application-Level Rich Object ---
/**
 * The rich object your application works with for Recaps.
 * The service layer is responsible for fetching the main RecapMetadata
 * and then querying the index for all RECAP_FLAG records matching the recapId
 * to reconstruct the flagsArray.
 */
export interface RecapInfo extends Omit<RecapMetadata, 'loreReferenceList' | 'historyReferenceList'> {
  content: string;
  flagList: string[];
  loreReferenceList: Reference[];
  historyReferenceList: Reference[];
}

const referenceSchema = z.object({ id: z.string().min(1), relevance: z.number().finite() });

/** Browser-written and imported recaps share one deliberately untrusted data contract. */
const recapInfoBaseSchema = z.object({
  type: z.enum([METADATA_TYPES.RECAP, METADATA_TYPES.RELATIONSHIP]),
  recapId: z.string().min(1),
  sessionId: z.string().min(1),
  characterId: z.string().min(1),
  userId: z.string().min(1),
  profileId: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  turnStart: z.number().int().nonnegative(),
  turnEnd: z.number().int().nonnegative(),
  model: z.string().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
  flagList: z.array(z.string().max(200)).max(500),
  loreReferenceList: z.array(referenceSchema).max(500),
  historyReferenceList: z.array(referenceSchema).max(500),
});

const validTurnRange = (recap: { turnStart: number; turnEnd: number }) => recap.turnEnd >= recap.turnStart;
const turnRangeIssue = {
  message: 'turnEnd must be greater than or equal to turnStart.',
  path: ['turnEnd'],
};

export const recapInfoSchema = recapInfoBaseSchema.refine(validTurnRange, turnRangeIssue);

export const recapWriteSchema = recapInfoBaseSchema
  .extend({
    characterId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    profileId: z.string().min(1).optional(),
  })
  .refine(validTurnRange, turnRangeIssue);
