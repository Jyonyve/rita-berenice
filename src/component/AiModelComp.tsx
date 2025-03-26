import { useAiModel } from '@hook/useAiModel';
import { useEffect } from 'react';
import { useErrorDialog } from '@shared/useMuiComp';
import { useChat } from '@hook/useChat';
import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { defaultAiInfo, supportingAiInfo } from '@domain/aimodel';

export const AiModelComp = ({
	sessionId,
	model = defaultAiInfo.model,
}: {
	sessionId: string;
	model?: string;
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
					{/* Map over the categories */}
					{Object.keys(supportingAiInfo).map((category) => (
						<div key={category}>
							{/* MenuItem for category label */}
							<MenuItem disabled>{category}</MenuItem>
							{/* Map over the models under each category */}
							{supportingAiInfo[category].map((modelName) => (
								<MenuItem key={modelName} value={modelName}>
									{modelName}
								</MenuItem>
							))}
						</div>
					))}
				</Select>
			</FormControl>
		</Box>
	);
};
