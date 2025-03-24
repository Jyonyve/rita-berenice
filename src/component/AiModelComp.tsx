import { AiModelInfo } from '@domain/aimodel';
import { ChatComp } from './ChatComp';
import { useAiModel } from '@hook/useAiModel';
import { defaultAiInfo, isValidAiModelInfo, supportingAiInfo } from '@util/aiTypeModelUtils';
import { ChangeEvent, useEffect } from 'react';
import { SelectAiModel, useErrorDialog } from '@shared/useMuiComp';
import { useChat } from '@hook/useChat';
import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';

export const AiModelComp = ({
	model = defaultAiInfo.model,
	sessionId,
}: {
	model: string;
	sessionId: string;
}) => {
	// Initialize the AI service
	// Get the AI model and LLM client
	const { aiModelInfo, changeAiModel } = useAiModel();
	const { currentSessionId, changeSessionId } = useChat();

	// hook
	const { showError } = useErrorDialog();

	const handleModelChange = (event: SelectChangeEvent) => {
		changeAiModel(event.target.value);
	};

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
		if (model !== aiModelInfo?.model) {
			changeAiModel(model);
		}
	}, [model]);

	return (
		<Box sx={{ marginBottom: 3 }}>
			<FormControl fullWidth>
				<InputLabel id="ai-model-select-label">Select AI Model</InputLabel>
				<Select
					labelId="ai-model-select-label"
					value={model}
					label="Select AI Model"
					onChange={handleModelChange}
				>
					{Object.keys(supportingAiInfo).map((category) => (
						<React.Fragment key={category}>
							<MenuItem disabled>{category}</MenuItem>
							{supportingAiInfo[category].map((modelName) => (
								<MenuItem key={modelName} value={modelName}>
									{modelName}
								</MenuItem>
							))}
						</React.Fragment>
					))}
				</Select>
			</FormControl>
		</Box>
	);
};
