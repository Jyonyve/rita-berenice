// src/client/component/user/ApiKeysSection.tsx
import { useEffect, useState } from 'react';
import { Box, Grid, Typography, TextField, InputAdornment, IconButton, Alert } from '@mui/material';
import { Visibility, VisibilityOff, Key, Save } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { GlassCard, SolidMetallicButton } from '../../layout/index.ts';
import { useCredentialApi } from '../../hook/api/useCredentialApi.ts';
import { useToast } from '../../provider/ToastProvider.tsx';
import { UserApiKeys } from '#shared/domain/credential/CredentialInterfaces.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

// API Key configuration
const API_KEY_CONFIG = [
	{
		key: 'openaiApiKey' as keyof UserApiKeys,
		label: 'OpenAI API Key',
		placeholder: 'sk-...',
		description: 'For GPT models',
	},
	{
		key: 'anthropicApiKey' as keyof UserApiKeys,
		label: 'Anthropic API Key',
		placeholder: 'sk-ant-...',
		description: 'For Claude models',
	},
	{
		key: 'googleApiKey' as keyof UserApiKeys,
		label: 'Google API Key',
		placeholder: 'AIza...',
		description: 'For Gemini models',
	},
	{
		key: 'openrouterApiKey' as keyof UserApiKeys,
		label: 'OpenRouter API Key',
		placeholder: 'sk-or-...',
		description: 'Access to multiple LLM providers',
	},
	{
		key: 'groqApiKey' as keyof UserApiKeys,
		label: 'Groq API Key',
		placeholder: 'gsk_...',
		description: 'For Groq models',
	},
];

export const CredentialSection: React.FC<{ userId: string; userApiKeys: UserApiKeys }> = ({
	userId,
	userApiKeys,
}) => {
	const { addToast } = useToast();
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const { storeUserApiKeys } = useCredentialApi();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting, isDirty },
		reset,
	} = useForm<UserApiKeys>({ defaultValues: userApiKeys });

	useEffect(() => {
		if (userApiKeys && Object.keys(userApiKeys).length > 0) {
			reset(userApiKeys);
		}
	}, [userApiKeys]);

	const toggleVisibility = (keyType: string) => {
		setShowKeys((prev) => ({ ...prev, [keyType]: !prev[keyType] }));
	};

	const onSubmit = async (data: UserApiKeys) => {
		try {
			// Filter out empty values
			const filteredData = Object.fromEntries(
				Object.entries(data).filter(([, value]) => value && value.trim() !== '')
			) as UserApiKeys;

			await storeUserApiKeys({ userId, apiKeys: filteredData });
			addToast(getLangAlertText(LANG_KEYS.API_KEYS_SAVED_SUCCESS), 'success');
			reset(data); // Reset form dirty state
		} catch (error: any) {
			addToast(error.message || getLangAlertText(LANG_KEYS.API_KEYS_SAVE_FAILED), 'error');
		}
	};

	return (
		<GlassCard variant="outlined">
			<Box display="flex" alignItems="center" gap={1} mb={2}>
				<Key color="primary" />
				<Typography variant="h6" color="primary">
					{getLangText(LANG_KEYS.API_KEYS)}
				</Typography>
			</Box>

			<Alert severity="info" sx={{ mb: 3 }}>
				{getLangText(LANG_KEYS.API_KEYS_DESCRIPTION)}
			</Alert>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Grid container spacing={3}>
					{API_KEY_CONFIG.map((config) => (
						<Grid size={{ xs: 12 }} key={config.key}>
							<Controller
								name={config.key}
								control={control}
								render={({ field }) => (
									<TextField
										{...field}
										fullWidth
										label={config.label}
										placeholder={config.placeholder}
										type={showKeys[config.key] ? 'text' : 'password'}
										helperText={config.description}
										slotProps={{
											input: {
												endAdornment: (
													<InputAdornment position="end">
														<IconButton onClick={() => toggleVisibility(config.key)} edge="end" size="small">
															{showKeys[config.key] ? <VisibilityOff /> : <Visibility />}
														</IconButton>
													</InputAdornment>
												),
											},
										}}
									/>
								)}
							/>
						</Grid>
					))}
				</Grid>

				<Box display="flex" justifyContent="flex-end" mt={3}>
					<SolidMetallicButton
						type="submit"
						colorVariant="gold"
						startIcon={<Save />}
						disabled={isSubmitting || !isDirty}
						loading={isSubmitting}
					>
						{isSubmitting ? getLangText(LANG_KEYS.SAVING) : getLangText(LANG_KEYS.SAVE_API_KEYS)}
					</SolidMetallicButton>
				</Box>
			</form>
		</GlassCard>
	);
};
