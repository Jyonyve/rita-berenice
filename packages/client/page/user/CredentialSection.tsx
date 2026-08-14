import { useState } from 'react';
import { Alert, Box, Grid, IconButton, InputAdornment, TextField } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Controller, useForm } from 'react-hook-form';
import type { ApiKeyType, UserApiKeys } from '@rita-berenice/shared/domain';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { GlassButton, GlassCard } from '../../layout/component/index.js';
import { useCredentialApi } from '../../hook/api/useCredentialApi.js';
import { useToast } from '../../provider/ToastProvider.tsx';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { API_KEY_CONFIG } from './apiKeyConfig.js';

interface CredentialSectionProps {
	userId: string;
	configuredKeyTypes: ApiKeyType[];
}

export function CredentialSection({ userId, configuredKeyTypes }: CredentialSectionProps) {
	const { addToast } = useToast();
	const { updateUserApiKey } = useCredentialApi();
	const [showKeys, setShowKeys] = useState<Partial<Record<ApiKeyType, boolean>>>({});
	const {
		control,
		handleSubmit,
		reset,
		formState: { isSubmitting },
	} = useForm<UserApiKeys>({ defaultValues: {} });

	const save = handleSubmit(async (values) => {
		const replacements = Object.entries(values).filter(
			(entry): entry is [ApiKeyType, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''
		);
		if (replacements.length === 0) return;

		try {
			for (const [keyType, keyValue] of replacements) {
				await updateUserApiKey({ userId, keyType, keyValue: keyValue.trim() });
			}
			reset({});
			addToast(getLangAlertText(LANG_KEYS.API_KEYS_SAVED_SUCCESS), 'success');
		} catch (error) {
			addToast(
				error instanceof Error ? error.message : getLangAlertText(LANG_KEYS.API_KEYS_SAVE_FAILED),
				'error'
			);
		}
	});

	return (
		<GlassCard variant="elevation">
			<Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
				{getLangText(LANG_KEYS.API_KEYS_DESCRIPTION)} Saved values are never shown; enter a value only
				to add or replace a key.
			</Alert>
			<Grid container spacing={2}>
				{API_KEY_CONFIG.map((config) => {
					const configured = configuredKeyTypes.includes(config.key);
					return (
						<Grid size={{ xs: 12 }} key={config.key}>
							<Controller
								name={config.key}
								control={control}
								render={({ field }) => (
									<TextField
										{...field}
										value={field.value ?? ''}
										fullWidth
										size="small"
										label={`${config.label} API Key`}
										placeholder={config.placeholder}
										type={showKeys[config.key] ? 'text' : 'password'}
										helperText={
											configured ? 'Configured. Enter a new value to replace it.' : 'Not configured.'
										}
										slotProps={{
											input: {
												endAdornment: (
													<InputAdornment position="end">
														<IconButton
															onClick={() =>
																setShowKeys((current) => ({ ...current, [config.key]: !current[config.key] }))
															}
															edge="end"
															aria-label={`Show ${config.label} API key`}
														>
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
					);
				})}
			</Grid>
			<Box display="flex" justifyContent="flex-end" mt={2}>
				<GlassButton
					onClick={save}
					colorVariant="secondary"
					disabled={isSubmitting}
					loading={isSubmitting}
				>
					{isSubmitting ? getLangText(LANG_KEYS.SAVING) : getLangText(LANG_KEYS.SAVE_API_KEYS)}
				</GlassButton>
			</Box>
		</GlassCard>
	);
}
