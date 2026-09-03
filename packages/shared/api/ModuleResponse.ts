import { EmotionValue, PortraitUrlMap } from '../config/emotionConstants.js';
import { LangCode } from '../config/langConstants.js';
import {
  CharacterInfo,
  CharacterTermInfo,
  ChatTurn,
  DisplayTurn,
  HistoryInfo,
  LoreInfo,
  ProfileInfo,
  RecapInfo,
  SessionInfo,
  SessionTermInfo,
  TempChatTurn,
  UserInfo,
  ValidationResult,
  ChatEntry,
  ApiKeyType,
  DocumentInfo,
} from '../domain/index.js';

export interface ApiErrorResponse {
  status: 'error'; // Literal string to indicate an error response
  code: number; // The HTTP status code
  message: string; // The client-friendly error message
  debug?: string; // Optional: for development, the original internal error message
  details?: any;
}

export type Metadata = Record<string, string | number | boolean | null>;

/**
 * Vector-search result shape returned by the pgvector retrieval path.
 *
 * This is the retrieval path's own type and nothing else: the semantic ranking helpers in
 * `queryUtils` / `llmUtils` take it directly. The module responses below deliberately do NOT
 * extend it - they used to, which forced every CRUD read to build `documents` and `metadatas`
 * that no caller ever read. Swapping in a different vector store means adapting its results into
 * this type, not putting these fields back onto the CRUD responses.
 */
export type VectorSearchResponse = {
  ids: string[];
  metadatas: (Metadata | null)[];
  documents: (string | null)[];
  distances?: (number | null)[] | null | undefined;
};

// Module responses: domain payloads only.
export type CharacterResponse = {
  characterInfo: CharacterInfo;
  characterInfos: CharacterInfo[];
  characterPortraits: Record<string, PortraitUrlMap>;
  characterAvatars: Record<string, PortraitUrlMap>;
};

export type ProfileResponse = {
  profileInfo: ProfileInfo;
  profileInfos: ProfileInfo[];
  profilePortraits: Record<string, string>;
  profileAvatars: Record<string, string>;
};

export type ChatResponse = { chatTurns: ChatTurn[]; displayTurns: DisplayTurn[] };

export type TempChatResponse = { tempChatTurns: TempChatTurn[]; tempChatTurn: TempChatTurn };

export type LoreResponse = {
  loreInfo: LoreInfo;
  loreContent: string;
  loreInfos: LoreInfo[];
  loreContents: string[];
};

export type HistoryResponse = {
  historyInfo: HistoryInfo;
  historyContent: string;
  historyInfos: HistoryInfo[];
  historyContents: string[];
  historyImageUrls: Record<string, string>;
};

export type RecapResponse = {
  recapInfo: RecapInfo;
  recapInfos: RecapInfo[];
  recapContent: string;
  recapContents: string[];
};

export type TermResponse = {
  term: Term;
  terms: Term[];
  characterTermInfos: CharacterTermInfo[];
  sessionTermInfos: SessionTermInfo[];
};

export type Term = Pick<CharacterTermInfo | SessionTermInfo, 'koreanTerm' | 'englishTerm' | 'termId' | 'type'>;

export type MemoryResponse = {
  langCode: LangCode;
  shortTermHistory: ChatTurn[]; // Last 5-10 turns
  longTermHistory: ChatTurn[]; // Semantically relevant past turns
  relevantLore: LoreInfo[];
  relevantHistory: HistoryInfo[];
  relevantDocuments?: DocumentInfo[];
  relevantRecaps?: RecapInfo[];
  factualRecapSummary?: string;
  relationshipRecapSummary?: string;
};

export type PersonaResponse = {
  response: string;
  emotion: EmotionValue;
  generationStatus?: 'complete' | 'length_limited';
};

export type UserResponse = { userInfo: UserInfo; userInfos: UserInfo[] };

export type SessionResponse = { sessionInfo: SessionInfo; sessionInfos: SessionInfo[] };

export type CredentialMetadataResponse = { configuredKeyTypes: ApiKeyType[] };

export type CredentialValidationResponse = { validationResults: Record<string, ValidationResult> };

export type ModelCatalogEntry = {
  id: string;
  name: string;
  platform: 'openrouter' | 'direct';
  provider: 'openai' | 'anthropic' | 'google';
  contextWindow: number;
  maxOutputTokens: number;
  recommendedOutputTokens: number;
  supportsTemperature: boolean;
  source: 'live' | 'fallback';
};

export type ModelCatalogResponse = {
  models: ModelCatalogEntry[];
  refreshedAt: string;
  source: 'live' | 'fallback';
};

export type DocumentResponse = { documentInfo: DocumentInfo; documentInfos: DocumentInfo[] };
