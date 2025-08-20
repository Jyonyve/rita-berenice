// src/server/routes/persona.routes.ts

import express, { type Request, type Response } from 'express';

import { personaEngine } from '../service/personaEngine.js';
import { ChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { asyncHandler, genRoutePattern, validateRequestData } from '../util/routeHelpers.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

const router = express.Router();

// Define a type for the complex request body for clarity and type safety
type GenerateResponseRequestBody = {
	recalledMemories: MemoryResponse;
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	currentUserRequest: ChatMessage;
	aiModelInfo: AiModelInfo;
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
		const { recalledMemories, characterInfo, profileInfo, currentUserRequest, aiModelInfo } =
			req.body;

		// Validate the presence of all required top-level objects in the request body
		const requiredFields: (keyof GenerateResponseRequestBody)[] = [
			'recalledMemories',
			'characterInfo',
			'profileInfo',
			'currentUserRequest',
			'aiModelInfo',
		];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('generateResponse');
		console.log(`API HIT: POST ${path} for character ${characterInfo.name}`);

		// Call the personaEngine with all necessary data and the request's AbortSignal
		const response = await personaEngine.generateResponse(
			recalledMemories,
			characterInfo,
			profileInfo,
			currentUserRequest,
			aiModelInfo,
			{ signal: (req as any).signal } // Pass the signal for cancellation handling
		);

		res.status(200).json(response);
	})
);

export default router;
