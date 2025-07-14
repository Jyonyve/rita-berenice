// src/client/component/page/chat/AiModelSelector.tsx

import React, { useEffect } from 'react';
import { useAiModel } from '#client/hook/useAiModel.js';
import {
	FormControl,
	InputLabel,
	MenuItem,
	ListSubheader,
	alpha,
	Typography,
	Divider,
} from '@mui/material';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { GlassSelect } from '../../layout/glass/index.js';
import { getGlassEffect, glassEffect, glassEffectLight } from '../../style/glassEffect.js';
export const AiModelSelector = () => {
	const { aiModelInfo, changeAiModel } = useAiModel();

	const handleModelChange = (eventValue: string) => {
		changeAiModel(eventValue);
	};
	const modelOptions = Object.entries(supportAiModelInfo).flatMap(([platform, providers]) => {
		// THE FIX: The platform header now has the prominent, uppercase style.
		const platformHeader = (
			<ListSubheader
				key={platform}
				sx={(theme) => ({
					fontSize: '0.75rem',
					fontStyle: 'italic',
					color: theme.palette.text.secondary,
					backgroundColor: alpha(theme.palette.background.default, 0.9),
					borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
					lineHeight: '24px',
					py: 0.5,
				})}
			>
				{platform}
			</ListSubheader>
		);

		const providerItems = Object.entries(providers).flatMap(([provider, models]) => {
			// THE FIX: The provider sub-header now has the subtler, italic style.
			const providerHeader = (
				<ListSubheader
					key={`${platform}-${provider}`}
					sx={(theme) => ({
						pl: 4,
						bgcolor: 'transparent',
						py: 0.5,
						fontWeight: 'bold',
						fontSize: '0.8rem',
						textTransform: 'uppercase',
						color: theme.palette.primary.dark,
					})}
				>
					{provider}
				</ListSubheader>
			);

			const modelItems = models.map((modelName) => (
				<MenuItem
					key={modelName}
					value={modelName}
					sx={{
						pl: 6,
						py: 0.5,
						fontSize: '0.8rem',
						color: 'text.secondary',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						'&:hover': {
							backgroundColor: 'transparent',
							boxShadow: (theme) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.5)}`,
						},
						'&.Mui-selected': {
							backgroundColor: 'transparent',
							boxShadow: (theme) => `inset 0 0 0 1.5px ${alpha(theme.palette.primary.main, 0.8)}`,
							'&:hover': {
								backgroundColor: 'transparent',
								boxShadow: (theme) => `inset 0 0 0 1.5px ${alpha(theme.palette.primary.main, 1)}`,
							},
						},
					}}
				>
					{platform === 'openrouter' ? modelName.split('/').pop() : modelName}
				</MenuItem>
			));

			// THE FIX: The divider has been completely removed.
			return [providerHeader, ...modelItems];
		});

		return [platformHeader, ...providerItems];
	});

	return (
		<FormControl variant="outlined" size="small">
			<InputLabel id="ai-model-select-label" sx={{ color: 'text.secondary' }}>
				AI Model
			</InputLabel>
			<GlassSelect
				labelId="ai-model-select-label"
				id="ai-model-select"
				value={aiModelInfo?.model || ''}
				label="AI Model"
				onChange={(e) => handleModelChange(`${e.target.value}`)}
				MenuProps={{
					PaperProps: {
						className: 'hide-scrollbar',
						sx: (theme) => {
							const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;
							const { '&:hover': hoverStyles, ...baseStyles } = styleObject;

							return { ...baseStyles, ...hoverStyles };
						},
					},
				}}
			>
				{modelOptions}
			</GlassSelect>
		</FormControl>
	);
};
