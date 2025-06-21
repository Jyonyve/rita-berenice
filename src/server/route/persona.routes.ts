// src/server/routes/persona.routes.ts

import express, { type Request, type Response } from 'express';
import {
	genRoutePattern,
	PersonaResponse,
	MemoryResponse,
	CharacterInfo,
	ProfileInfo,
	ChatMessage,
} from '#shared/index.ts';
import { asyncHandler, validateRequestData } from '../util/index.ts';
import { personaEngine } from '../service/personaEngine.ts';

const router = express.Router();

// Define a type for the complex request body for clarity and type safety
type GenerateResponseRequestBody = {
	recalledMemories: MemoryResponse;
	characterInfo: CharacterInfo;
	userInfo: ProfileInfo;
	currentUserRequest: ChatMessage;
};

/**
 * POST /api/persona/generate-response
 * Orchestrates the generation of a character's response based on a comprehensive
 * payload of memory, context, and persona information.
 * @param {GenerateResponseRequestBody} req.body - The full payload required for response generation.
 * @returns {PersonaResponse} An object containing the character's response text and associated emotion.
 */
router.post(
	genRoutePattern('generateResponse'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { recalledMemories, characterInfo, userInfo, currentUserRequest } = req.body;

		// Validate the presence of all required top-level objects in the request body
		const requiredFields: (keyof GenerateResponseRequestBody)[] = [
			'recalledMemories',
			'characterInfo',
			'userInfo',
			'currentUserRequest',
		];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('generateResponse');
		console.log(`API HIT: POST ${path} for character ${characterInfo.name}`);

		// Call the personaEngine with all necessary data and the request's AbortSignal
		const response = await personaEngine.generateResponse(
			recalledMemories,
			characterInfo,
			userInfo,
			currentUserRequest,
			{ signal: (req as any).signal } // Pass the signal for cancellation handling
		);

		res.status(200).json(response);
	})
);

export default router;
