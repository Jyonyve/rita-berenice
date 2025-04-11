// src/server/services/aiService.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import OpenAI from 'openai'; // For OpenRouter

import {
	AiModelInfo,
	ChatRoleType,
	convertMessageContentToString,
	CredentialDataType,
	extractValidOpenAiContent,
	isDirectOpenAIClient,
} from '#root/src/shared/index.ts';
import { credentialService } from './credentialService.ts';

export const llmService = {
	createLlmInstance: async (aiInfo: AiModelInfo): Promise<BaseChatModel | OpenAI> => {
		//
		const { platform, provider, model } = aiInfo;
		const credentials = await credentialService.getUserSecret();

		if (!credentials) {
			// Allow fallback to local/free models if credentials aren't set up *at all*
			console.warn(
				'Credentials not found. Only local or free models without key requirements will work.'
			);
		}

		// Helper to get a specific key or throw if required
		const getRequiredApiKey = (keyName: CredentialDataType): string => {
			const key = credentials?.[keyName];
			if (!key) {
				throw new Error(
					`Required API key "${keyName}" not found in user credentials for model ${platform}/${provider}/${model}. Please configure credentials.`
				);
			}
			return key;
		};

		try {
			switch (platform) {
				case 'direct': {
					let apiKey: string;
					switch (provider) {
						case 'openai':
							apiKey = getRequiredApiKey('OPENAI_API_KEY');
							return new ChatOpenAI({ model, apiKey });
						case 'anthropic':
							apiKey = getRequiredApiKey('ANTHROPIC_API_KEY');
							return new ChatAnthropic({ model, apiKey });
						case 'google':
							apiKey = getRequiredApiKey('GOOGLE_API_KEY');
							return new ChatGoogleGenerativeAI({ model, apiKey });
						default:
							throw new Error(`Unsupported direct provider: ${provider}`);
					}
				}

				case 'openrouter': {
					const apiKey = getRequiredApiKey('OPENROUTER_API_KEY');
					// Langchain doesn't have a dedicated OpenRouter class, use OpenAI client config
					// Note: Langchain's ChatOpenAI *can* take baseURL, but using OpenAI client is common for OR
					return new OpenAI({
						baseURL: 'https://openrouter.ai/api/v1',
						apiKey: apiKey,
						defaultHeaders: {
							'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice', // Optional but recommended by OpenRouter
							'X-Title': 'Rita Berenice', // Optional
						},
						// Dangerously allow browser = true; // THIS IS DANGEROUS if you ever ran this client-side by mistake
					});
					// If you prefer using Langchain's ChatOpenAI for consistency:
					// return new ChatOpenAI({
					//    model: model, // OpenRouter needs the full model string here
					//    apiKey: apiKey,
					//    configuration: {
					//        baseURL: "https://openrouter.ai/api/v1",
					//        defaultHeaders: {
					//            'HTTP-Referer': 'YOUR_SITE_URL',
					//            'X-Title': 'Rita Berenice',
					//        },
					//    }
					// });
				}

				// case 'bedrock':
				//  // Fetch Bedrock specific credentials from `credentials` object
				//  const awsCredentials = {
				//      region: credentials?.BEDROCK_CONFIG?.AWS_REGION,
				//      accessKeyId: credentials?.BEDROCK_CONFIG?.AWS_ACCESS_KEY_ID,
				//      secretAccessKey: credentials?.BEDROCK_CONFIG?.AWS_SECRET_ACCESS_KEY,
				//  };
				//  if (!awsCredentials.region || !awsCredentials.accessKeyId || !awsCredentials.secretAccessKey) {
				//      throw new Error("AWS Bedrock credentials missing.");
				//  }
				//  // Use appropriate LangChain AWS class, passing credentials
				//  // return new ChatBedrockConverse({ model, credentials: awsCredentials });
				//  throw new Error("Bedrock provider not fully implemented yet.");

				case 'local': {
					const localUrl = process.env.LOCAL_AI_URL;
					return new ChatOllama({ model, ...(localUrl && { baseUrl: localUrl }) });
				}

				default:
					throw new Error(`Unsupported AI platform: ${platform} for model ${model}.`);
			}
		} catch (error) {
			console.error(`Failed to create LLM instance for ${platform}/${provider}/${model}:`, error);
			// Re-throw the error to be handled by the calling API route
			throw error;
		}
	},

	invokeLlm: async (
		role: ChatRoleType,
		content: string,
		aiModelInfo: AiModelInfo
	): Promise<string> => {
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);
		let responseContent = '';
		const message = { role, content };

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				console.log(`Invoking direct OpenAI client (${aiModelInfo.model})`);
				const completion = await llmOrClient.chat.completions.create({
					model: aiModelInfo.model,
					messages: [message],
				});
				responseContent = extractValidOpenAiContent(completion);
			} else {
				// Assumes LangChain BaseChatModel
				console.log(`Invoking LangChain model (${aiModelInfo.model})`);
				const responseMessage = await llmOrClient.invoke([message]);
				responseContent = convertMessageContentToString(responseMessage.content);
			}

			if (!responseContent) {
				console.warn(`LLM invocation (${aiModelInfo.model}) resulted in empty response.`);
				return '[LLM returned empty content]'; // Return specific string for empty
			}
			return responseContent;
		} catch (error) {
			console.error(`LLM invocation failed for ${aiModelInfo.model}:`, error);
			// Rethrow or return error message? Rethrowing is often better for API routes.
			throw new Error(`LLM invocation failed: ${error || 'Unknown error'}`);
		}
	},
};
