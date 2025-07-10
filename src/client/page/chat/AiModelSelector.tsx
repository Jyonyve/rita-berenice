// src/client/component/page/chat/AiModelSelector.tsx

import React, { useEffect } from 'react';
import { useAiModel } from '#client/hook/useAiModel.js';
import {
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	ListSubheader,
} from '@mui/material';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';

interface AiModelSelectorProps {
	sessionId: string;
}

export const AiModelSelector = ({ sessionId }: AiModelSelectorProps) => {
	const { aiModelInfo, changeAiModel } = useAiModel();

	const handleModelChange = (event: SelectChangeEvent<string>) => {
		changeAiModel(event.target.value);
	};

	// Create a flat array of JSX elements for the options
	const modelOptions = Object.entries(supportAiModelInfo).flatMap(([platform, providers]) => {
		const platformHeader = <ListSubheader key={platform}>{platform.toUpperCase()}</ListSubheader>;

		const providerItems = Object.entries(providers).flatMap(([provider, models]) => {
			const providerHeader = (
				<ListSubheader key={`${platform}-${provider}`} sx={{ pl: 4 }}>
					{provider}
				</ListSubheader>
			);
			const modelItems = models.map((modelName) => (
				<MenuItem key={modelName} value={modelName} sx={{ pl: 6 }}>
					{/* Show a cleaner name for OpenRouter models */}
					{platform === 'openrouter' ? modelName.split('/').pop() : modelName}
				</MenuItem>
			));
			return [providerHeader, ...modelItems];
		});

		return [platformHeader, ...providerItems];
	});

	return (
		// Use a smaller size and variant for a more compact look
		<FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
			<InputLabel id="ai-model-select-label">AI Model</InputLabel>
			<Select
				labelId="ai-model-select-label"
				id="ai-model-select"
				value={aiModelInfo?.model || ''}
				label="AI Model"
				onChange={handleModelChange}
			>
				{modelOptions}
			</Select>
		</FormControl>
	);
};
