import { ChatRoleType } from '../domain/chat/chat.type.js';
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

export interface ReceiveBotResponseRequest {
	sessionId: string;
	sequence: number;
	entries: ChatEntry[];
	modelName: AllModelNames;
}

export type ChatGenerationStage = 'preparing' | 'retrieving' | 'generating' | 'saving';

export type ReceiveBotResponseStreamEvent =
	| { type: 'status'; stage: ChatGenerationStage }
	| { type: 'delta'; text: string }
	| { type: 'complete'; data: TempChatTurn }
	| { type: 'error'; message: string; clientMessage?: string };

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
}

export interface EnqueueFinalizationResponse {
	job: FinalizationJobSnapshot;
	displayTurn: DisplayTurn;
}
