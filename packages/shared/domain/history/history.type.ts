// src/shared/domain/history/HistoryInterfaces.ts

import { METADATA_TYPES } from '../../config/index.js';
import { RelatedEvent } from '../BaseTypes.js';
import { z } from 'zod';

export type EventDateType = 'absolute_date' | 'estimated_year' | 'relative_to_event' | 'era_defined';

export type HistoryCategory =
  | 'Origin Story'
  | 'Major Life Event'
  | 'Relationship Turnpoint'
  | 'Career & Faction'
  | 'Conflict & War'
  | 'Internal Struggle'
  | 'Other';

// Same content types as lore, but could diverge in the future
export type HistoryIndexContentType = 'AFFECTED_CHARACTER' | 'KEYWORD' | 'TOPIC' | 'ENTITY' | 'RELATED_EVENT';

// --- 1. PRIMARY DOCUMENT METADATA ---
export interface HistoryMetadata {
  type: typeof METADATA_TYPES.HISTORY;
  historyId: string;
  characterId: string; // The primary owner
  userId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  generatedTitle: string;
  category: HistoryCategory;
  summary: string;
  periodLabel: string;
  eventDateValue: string;
  eventDateType: EventDateType;
}

// --- 2. SEARCH INDEX METADATA ---
export interface HistoryIndexMetadata {
  type: typeof METADATA_TYPES.INDEX;
  contentType: HistoryIndexContentType;
  historyId: string; // Foreign key to primary history document
  value: string; // The actual keyword/topic/entity/characterId value
  characterId: string; // Always present - primary character who owns this history
  userId: string; // For user-specific filtering
  category: HistoryCategory; // Always present for filtering
  originalCreatedAt: string; // For sorting/filtering by date
}

// --- 3. RICH APPLICATION-LEVEL INTERFACE ---
export interface HistoryInfo extends HistoryMetadata {
  content: string;
  sideCharacterIdList: string[]; // Other characters involved (excludes primary characterId)
  allAffectedCharacterIdList: string[]; // All characters (includes primary + side)
  relatedEventList: RelatedEvent[]; // From 'RELATED_EVENT' index records
  keywordList: string[]; // From 'KEYWORD' index records
  topicList: string[]; // From 'TOPIC' index records
  entityList: string[]; // From 'ENTITY' index records
}

// --- CDO TYPES ---
export type HistoryCdo = Pick<HistoryInfo, 'content' | 'title' | 'userId' | 'characterId'>;

export const historyCategories = [
  'Origin Story',
  'Major Life Event',
  'Relationship Turnpoint',
  'Career & Faction',
  'Conflict & War',
  'Internal Struggle',
  'Other',
] as const satisfies readonly HistoryCategory[];

export const eventDateTypes = [
  'absolute_date',
  'estimated_year',
  'relative_to_event',
  'era_defined',
] as const satisfies readonly EventDateType[];

export const historyInfoSchema = z.object({
  type: z.literal(METADATA_TYPES.HISTORY),
  historyId: z.string().min(1),
  characterId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  generatedTitle: z.string().max(300),
  category: z.enum(historyCategories),
  summary: z.string().max(20_000),
  periodLabel: z.string().max(300),
  eventDateValue: z.string().max(300),
  eventDateType: z.enum(eventDateTypes),
  content: z.string().trim().min(1).max(100_000),
  sideCharacterIdList: z.array(z.string().min(1)).max(500),
  allAffectedCharacterIdList: z.array(z.string().min(1)).max(500),
  relatedEventList: z
    .array(
      z.object({
        id: z.string().min(1),
        relationship: z.string().max(500),
        description: z.string().max(5_000),
      }),
    )
    .max(500),
  keywordList: z.array(z.string().max(200)).max(500),
  topicList: z.array(z.string().max(200)).max(500),
  entityList: z.array(z.string().max(200)).max(500),
});

export const historyWriteSchema = historyInfoSchema.extend({
  userId: z.string().min(1).optional(),
});
