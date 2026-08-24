import { ChatRoleType } from '../domain/chat/chat.type.js';
import type { ApiKeyType } from '../domain/credential/credential.type.js';
import { AiModelInfo, AllModelNames } from '../domain/aimodel/index.js';
import { ChatEntry, ChatTurn, DisplayTurn, TempChatTurn } from '../domain/chat/chat.type.js';

// Common message structure
interface MessageContent {
	text: string;
	type?: string;
}

interface Message {
	role: string;
	content: MessageContent[];
}

// Common AI API request body structure
interface AiApiRequestBody {
	messages: Message[];
}

// Specific AI API request body structures
interface AnthropicRequestBody extends AiApiRequestBody {
	anthropic_version: string;
	max_tokens: number;
	top_k: number;
	stop_sequences: string[];
	temperature: number;
	top_p: number;
}

interface AmazonNovaRequestBody extends AiApiRequestBody {
	inferenceConfig: { max_new_tokens: number };
}

// Combined AI API request body type
type AiRequestBody = AnthropicRequestBody | AmazonNovaRequestBody;

// AI API request interface
export interface AiApiRequest {
	modelId: string;
	contentType: string;
	accept: string;
	body: AiRequestBody;
}

export interface BasicLlmRequestFormat {
	role: ChatRoleType;
	prompt: string;
	aiModelInfo: AiModelInfo;
}

/**
 * A reroll and a new message were previously the same call with the same shape, so the server
 * could not tell "regenerate this request" from "here is my next question" - and a temp turn that
 * failed to finalize quietly collected two unrelated requests as candidate responses for one turn.
 * The caller now says which it means.
 */
export type ReceiveBotResponseIntent = 'new' | 'reroll';

export interface ReceiveBotResponseRequest {
	sessionId: string;
	sequence: number;
	entries: ChatEntry[];
	modelName: AllModelNames;
	/** Absent means 'new'; older clients predate this field. */
	intent?: ReceiveBotResponseIntent;
}

export type ChatGenerationStage = 'preparing' | 'retrieving' | 'generating' | 'saving';

export type ReceiveBotResponseStreamEvent =
	| { type: 'status'; stage: ChatGenerationStage }
	| { type: 'delta'; text: string }
	| { type: 'complete'; data: TempChatTurn }
	| {
			type: 'error';
			message: string;
			clientMessage?: string;
			/** Set for failures the user can act on, e.g. a missing or rejected API key. */
			code?: string;
			keyType?: ApiKeyType;
	  };

export type FinalizationJobStatus = 'queued' | 'running' | 'retrying' | 'completed' | 'failed';

export interface FinalizationJobSnapshot {
	jobId: string;
	status: FinalizationJobStatus;
	attempts: number;
	maxAttempts: number;
	createdAt: string;
	updatedAt: string;
	result?: ChatTurn;
	error?: string;
	/**
	 * Set when the failure is one the user can act on - today, a missing or rejected API key.
	 * The client reuses the same rendering it already uses for a failed chat request, so a
	 * finalization that died on a missing key says so instead of blaming memory indexing.
	 */
	errorCode?: string;
	keyType?: ApiKeyType;
}

export interface EnqueueFinalizationResponse {
	job: FinalizationJobSnapshot;
	displayTurn: DisplayTurn;
}
