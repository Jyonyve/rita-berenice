// 1. Define the new 3-level structure for supporting AI info
export const supportAiModelInfo: Record<string, Record<string, string[]>> = {
	local: { exaone: ['exaone-deep:2.4b'], google: ['gemma3:1b', 'gemma3:1b-Q6_K'] },
	openrouter: {
		anthropic: [
			'anthropic/claude-4-sonnet',
			'anthropic/claude-3.7-sonnet',
			'anthropic/claude-3.5-sonnet',
			'anthropic/claude-3.5-sonnet-20240620',
			'anthropic/claude-3.5-haiku',
		],
		google: ['google/gemini-2.5-pro-exp-03-25:free', 'google/gemma-3n-e4b-it:free'],
		openai: ['openai/gpt-4o', 'openai/gpt-4o-mini'],
		deepseek: ['deepseek/deepseek-chat-v3-0324:free'],
		mistralai: ['mistralai/mistral-large-latest'],
		neversleep: ['neversleep/llama-3-lumimaid-70b', 'neversleep/llama-3.1-lumimaid-70b'],
		gryphe: ['gryphe/mythomax-l2-13b:free'],
	},
	bedrock: {
		anthropic: [
			'anthropic.claude-3-5-haiku-20241022-v1:0', // Default summary AI? Keep note.s
			'anthropic.claude-3-7-sonnet-20250219-v1:0',
		],
		amazon: ['amazon.nova-pro-v1:0'],
		// Add other Bedrock providers if necessary
	},
	direct: {
		// Mapping previous types to direct providers
		openai: ['gpt-4o', 'gpt-4o-mini'], // Previously 'gpt'
		anthropic: ['claude-3.7-sonnet', 'claude-3.5-haiku'], // Previously 'claude'
		google: ['gemini-2.5-pro-exp-03-25:free'], // Previously 'gemini'
	},
	// Google AI Studio/Gemini Developer API models
	googleai: {
		google: [
			// Stable models
			'gemini-2.0-flash-001',
			'gemini-2.0-flash-lite-001',
			// Preview models (recommended for prototyping)
			'gemini-2.5-pro-preview-05-06',
			'gemini-2.5-flash-preview-04-17',
			'gemini-2.0-flash-live-preview-04-09',
		],
		imagen: ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001'],
	},
} as const;
