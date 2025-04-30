// src/server/routes/ai.routes.ts (or chatGeneration.routes.ts)
import express, { type Request, type Response } from 'express';
import { llmService } from '#root/src/server/service/llmService.ts'; // Correct path
import { genRoutePattern, isValidAiModelInfo } from '#root/src/shared/index.ts';
import { AiModelInfo, ChatRoleType, ChatTurn } from '#root/src/shared/domain/index.ts';
// Import the necessary server-side utils

const router = express.Router();

// --- POST /api/llm/gen-response-from-llm ---
router.post(
	genRoutePattern('genResponseFromLlm', []), // Method name matches client call
	async (req: Request, res: Response): Promise<any> => {
		const path = genRoutePattern('genResponseFromLlm', []);
		console.log(`API HIT: POST ${path}`);

		try {
			const role: ChatRoleType = req.body.role;
			const prompt: string = req.body.prompt;
			const aiModelInfo: AiModelInfo = req.body.aiModelInfo;
			const personaInstruction: string = req.body.personaInstruction;

			// --- Validation ---
			if (!prompt || !personaInstruction || !isValidAiModelInfo(aiModelInfo)) {
				res.status(400).json({ message: 'Missing required LLM input fields.' });
				return;
			}

			// --- Call llmService to handle invocation ---
			const assistantResponse = await llmService.invokeLlm(
				role,
				prompt,
				aiModelInfo,
				personaInstruction
			);

			// --- Send Response ---
			return res.status(200).json({ assistantResponse });
		} catch (error: any) {
			// Error Handling (llmService might throw specific errors)
			console.error(`Error in POST ${path}:`, error);
			const statusCode = error.message.includes('Required API key') ? 401 : 500;
			return res.status(statusCode).json({ message: error.message || 'Failed to get response.' });
		}
	}
);
export default router;
