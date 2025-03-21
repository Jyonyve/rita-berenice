import { AiModelInfo } from '@domain/aimodel';
import { chatMemoryService } from './ChatComp';
import { useAiModel } from '@hook/useAiModel';
import { defaultAiInfo, isValidAiModelInfo } from '@util/aiTypeModelUtils';
import { useEffect } from 'react';
import { useErrorDialog } from 'shared/useDialog';
import { useChat } from '@hook/useChat';

export const AiModelComp = (model: string = defaultAiInfo.model, sessionId: string) => {
	// Initialize the AI service
	// Get the AI model and LLM client
	const { aiInfo, llm, changeAiModel } = useAiModel();
	const { currentSessionId, changeSessionId } = useChat();

	// hook
	const { showError } = useErrorDialog();

	// initialization
	useEffect(() => {
		if (!sessionId) {
			showError('No session ID provided');
		} else if (currentSessionId !== sessionId) {
			// TODO: add validation logic
			changeSessionId(sessionId);
		}
	}, [sessionId, currentSessionId]);

	// init and change AI model
	useEffect(() => {
		if (model !== aiInfo?.model) {
			changeAiModel(model);
		}
	}, [model]);

	return <>"Something change model component"</>;
};
