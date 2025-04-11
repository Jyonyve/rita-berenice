// src/client/hooks/useAiModel.ts
import { useState, useCallback } from 'react';
import {
	useErrorDialog,
	AiModelInfo,
	AllModelNames, // Keep this type
	// Import the keyless defaults and client-side utils
	DEFAULT_CHAT_MODEL_FREE, // Make sure this is defined without apiKey in shared types [6]
	DEFAULT_RECAP_MODEL_FREE, // Make sure this is defined without apiKey in shared types [6]
	getAiModelInfo, // Use the refactored client-side util [Phase 3]
	isValidAiModelInfo, // Use the refactored client-side util [Phase 3]
} from '@shared/index.ts'; // Adjust path as needed

// Determine initial states using the refactored utils (which don't include apiKey)
const initialDefaultAiInfo: AiModelInfo = DEFAULT_CHAT_MODEL_FREE; // Or use determineInitialDefaultAiInfo if preferred
const initialDefaultSummaryAiInfo: AiModelInfo = DEFAULT_RECAP_MODEL_FREE; // Or use determineDefaultSummaryAiInfo

export const useAiModel = () => {
	// --- State ---
	// Stores the user's currently selected AI model configuration (platform, provider, model)
	const [aiModelInfo, setAiModelInfo] = useState<AiModelInfo>(initialDefaultAiInfo);
	// Stores the AI model configuration used for summary tasks
	const [summaryAiModelInfo, setSummaryAiModelInfo] = useState<AiModelInfo>(
		initialDefaultSummaryAiInfo
	);

	// --- Hooks ---
	const { showError } = useErrorDialog();

	/**
	 * Changes the primary AI model selection based on the model name.
	 * Uses the client-side getAiModelInfo utility.
	 * @param modelName - The full name of the model selected by the user (e.g., "openai/gpt-4o").
	 */
	const changeAiModel = useCallback(
		(modelName: AllModelNames | string) => {
			// Accept string for broader input compatibility
			// Use the client-side utility to get structured info (no keys)
			const newAiInfo = getAiModelInfo(modelName);

			// Validate the structure and if it's supported (using client-side util)
			if (!isValidAiModelInfo(newAiInfo)) {
				const errorMsg = `Invalid or unsupported AI model selected: ${modelName}`;
				console.error(errorMsg, 'Resolved info:', newAiInfo);
				showError(errorMsg);
				return; // Don't update state if invalid
			}

			console.log('Setting AI model to:', newAiInfo);
			setAiModelInfo(newAiInfo);

			// Note: Summary model typically remains fixed, no update needed here unless desired.
		},
		[showError]
	); // Dependency: showError

	// --- Removed all LLM instance creation, state, credential logic, and effects ---

	// --- Return Hook Values ---
	return {
		/** The currently selected AiModelInfo for primary tasks (platform, provider, model) */
		aiModelInfo,
		/** The AiModelInfo used for summary tasks (platform, provider, model) */
		summaryAiModelInfo,
		/** Function to change the primary selected AI model based on its name */
		changeAiModel,
	};
};
