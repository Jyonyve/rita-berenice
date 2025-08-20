// src/client/component/page/chat/AiModelSelector.tsx

import { SUPPORTED_MODEL_INFO } from '#shared/config/supportAiModelInfo.js';
import { alpha, FormControl, InputLabel, ListSubheader } from '@mui/material';
import { GlassMenuItem, GlassSelect } from '../../layout/glass/index.js';
import { glassEffect, glassEffectLight } from '../../style/glassEffect.js';
import { AllModelNames } from '#shared/domain/aimodel/AiInfoTypes.js';
export const AiModelSelector = ({
	modelName,
	onAiModel,
}: {
	modelName: AllModelNames;
	onAiModel: (modelName: AllModelNames) => void;
}) => {
	const handleModelChange = (eventValue: string) => {
		onAiModel(eventValue);
	};
	const modelOptions = Object.entries(SUPPORTED_MODEL_INFO).flatMap(([platform, providers]) => {
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
				<GlassMenuItem key={modelName} value={modelName} sx={{ pl: 6, py: 0.5 }}>
					{platform === 'openrouter' ? modelName.split('/').pop() : modelName}
				</GlassMenuItem>
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
				value={modelName || ''}
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
