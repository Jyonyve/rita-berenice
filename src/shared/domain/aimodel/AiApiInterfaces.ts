import { ChatRoleType } from '../chat/ChatInterfaces.ts';
import { AiModelInfo } from './AiInfoTypes.ts';

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
