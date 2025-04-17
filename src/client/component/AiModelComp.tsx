import { useEffect } from 'react';
import { useErrorDialog } from '@shared/useMuiComp.tsx';
import { useChatClient, useAiModel } from '@client/hook/index.ts';
import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { DEFAULT_CHAT_MODEL_FREE, supportAiModelInfo } from '@shared/index.ts';

interface AiModelCompProps {
	sessionId: string;
	model?: string;
}

export const AiModelComp = ({
	sessionId,
	model = DEFAULT_CHAT_MODEL_FREE.model,
}: AiModelCompProps) => {
	const { aiModelInfo, changeAiModel } = useAiModel();
	const { showError } = useErrorDialog();

	const handleModelChange = (event: SelectChangeEvent<string>) => {
		changeAiModel(event.target.value);
	};

	// Session initialization
	useEffect(() => {
		if (!sessionId) {
			showError('No session ID provided');
			return;
		}
	}, [sessionId, showError]);

	// Model initialization
	useEffect(() => {
		if (model && aiModelInfo?.model !== model) {
			changeAiModel(model);
		}
	}, [model, aiModelInfo?.model, changeAiModel]);

	return (
		<Box sx={{ marginBottom: 3 }}>
			<FormControl fullWidth>
				<InputLabel id="ai-model-select-label">Select AI Model</InputLabel>
				<Select
					labelId="ai-model-select-label"
					id="ai-model-select"
					value={model}
					label="Select AI Model"
					onChange={handleModelChange}
				>
					{/* OpenRouter Models First */}
					<MenuItem disabled sx={{ bgcolor: 'action.hover' }}>
						OpenRouter Models
					</MenuItem>
					{Object.entries(supportAiModelInfo.openrouter).map(([provider, models]) => (
						<Box key={provider} sx={{ pl: 2 }}>
							<MenuItem disabled sx={{ fontWeight: 'bold' }}>
								{provider}
							</MenuItem>
							{models.map((modelName) => (
								<MenuItem key={modelName} value={modelName} sx={{ pl: 4 }}>
									{modelName.split('/').pop()}
								</MenuItem>
							))}
						</Box>
					))}

					{/* Other Platform Models */}
					{Object.entries(supportAiModelInfo)
						.filter(([platform]) => platform !== 'openrouter')
						.map(([platform, providers]) => (
							<Box key={platform}>
								<MenuItem disabled sx={{ bgcolor: 'action.hover' }}>
									{platform.toUpperCase()}
								</MenuItem>
								{Object.entries(providers).map(([provider, models]) => (
									<Box key={provider} sx={{ pl: 2 }}>
										<MenuItem disabled sx={{ fontWeight: 'bold' }}>
											{provider}
										</MenuItem>
										{models.map((modelName) => (
											<MenuItem key={modelName} value={modelName} sx={{ pl: 4 }}>
												{modelName}
											</MenuItem>
										))}
									</Box>
								))}
							</Box>
						))}
				</Select>
			</FormControl>
		</Box>
	);
};
