// src/server/routes/ai.routes.ts (or chatGeneration.routes.ts)
import express, { type Request, type Response } from 'express';

import { llmService } from '../service/llmService.js';
import { genRoutePattern } from '#shared/util/apiHelpers.js';
import { asyncHandler, CustomValidationRule, validateRequestData } from '../util/routeHelpers.js';
import { isValidAiModelInfo } from '#shared/util/aiModelUtils.js';

// Import the necessary server-side utils

const router = express.Router();

/**
 * POST /api/llm/invoke-llm
 * Invokes a language model with a single prompt and returns the response.
 * @param {object} req.body - Contains role, prompt, and aiModelInfo.
 * @returns {object} The assistant's response string.
 */
router.post(
	genRoutePattern('invokeLlm'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { role, prompt, aiModelInfo, userId } = req.body;

		const requiredFields = ['role', 'prompt', 'aiModelInfo', 'userId'];
		const customValidations: CustomValidationRule[] = [
			{
				predicate: (body) => !isValidAiModelInfo(body.aiModelInfo),
				status: 400,
				errorMessage: "'aiModelInfo' is invalid or incomplete.",
				clientMessage: 'The selected AI model configuration is not valid.',
			},
		];
		validateRequestData(req.body, 'body', requiredFields, customValidations);

		const path = genRoutePattern('invokeLlm');
		console.log(`API HIT: POST ${path} with model ${aiModelInfo.model}`);

		const assistantResponse = await llmService.invokeLlm(role, prompt, aiModelInfo, userId, {
			signal: (req as Request & { signal: AbortSignal }).signal,
		});
		res.status(200).json({ response: assistantResponse });
	})
);

/**
 * POST /api/llm/invoke-llm-from-messages
 * Invokes a language model with a full message history and returns a single response.
 * This is the primary endpoint for generating chat continuations.
 * @param {object} req.body - Contains the message history and aiModelInfo.
 * @returns {object} The assistant's response string (often JSON-formatted).
 */
router.post(
	genRoutePattern('invokeLlmFromMessages'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { messages, aiModelInfo, userId } = req.body;

		const requiredFields = ['messages', 'aiModelInfo', 'userId'];
		const customValidations: CustomValidationRule[] = [
			{
				predicate: (body) => !Array.isArray(body.messages) || body.messages.length === 0,
				status: 400,
				errorMessage: "'messages' must be a non-empty array.",
			},
			{
				predicate: (body) => !isValidAiModelInfo(body.aiModelInfo),
				status: 400,
				errorMessage: "'aiModelInfo' is invalid or incomplete.",
			},
		];
		validateRequestData(req.body, 'body', requiredFields, customValidations);

		const path = genRoutePattern('invokeLlmFromMessages');
		console.log(`API HIT: POST ${path} with model ${aiModelInfo.model}`);

		const assistantResponse = await llmService.invokeLlmFromMessages(messages, aiModelInfo, userId, {
			signal: (req as Request & { signal: AbortSignal }).signal,
		});
		res.status(200).json({ response: assistantResponse });
	})
);

/**
 * POST /api/llm/translate-proper-noun
 * Translates a single Korean term to English using a language model.
 * @param {object} req.body - Contains the koreanTerm to translate.
 * @returns {object} The translated English term.
 */
router.post(
	genRoutePattern('translateProperNoun'),
	asyncHandler(async (req: Request, res: Response<{ translation: string }>): Promise<void> => {
		const { koreanTerm, userId } = req.body;
		validateRequestData(req.body, 'body', ['koreanTerm', 'userId']);

		const path = genRoutePattern('translateProperNoun');
		console.log(`API HIT: POST ${path} for term "${koreanTerm}"`);

		const translation = await llmService.translateProperNoun(koreanTerm, userId);
		res.status(200).json({ translation });
	})
);

/**
 * POST /api/llm/extract-proper-nouns
 * Extracts an array of proper nouns from a given block of text.
 * @param {object} req.body - Contains the textToAnalyze.
 * @returns {object} An array of extracted nouns.
 */
router.post(
	genRoutePattern('extractProperNouns'),
	asyncHandler(async (req: Request, res: Response<{ nouns: string[] }>): Promise<void> => {
		const { textToAnalyze, userId } = req.body;
		validateRequestData(req.body, 'body', ['textToAnalyze', 'userId']);

		const path = genRoutePattern('extractProperNouns');
		console.log(`API HIT: POST ${path}`);

		const nouns = await llmService.extractProperNouns(textToAnalyze, userId);
		res.status(200).json({ nouns });
	})
);

export default router;
