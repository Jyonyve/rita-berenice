// src/client/component/user/CredentialSection.tsx
import { useEffect, useState, useMemo } from 'react';
import {
	Box,
	Grid,
	Typography,
	TextField,
	InputAdornment,
	IconButton,
	Alert,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextFieldProps,
} from '@mui/material';
import { Visibility, VisibilityOff, Save, CheckCircle, Warning, Error } from '@mui/icons-material';
import { useForm, Controller, useWatch } from 'react-hook-form';
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
		provider: 'OpenAI',
	},
	{
		key: 'anthropicApiKey' as keyof UserApiKeys,
		label: 'Anthropic API Key',
		placeholder: 'sk-ant-...',
		provider: 'Anthropic',
	},
	{
		key: 'googleApiKey' as keyof UserApiKeys,
		label: 'Google API Key',
		placeholder: 'AIza...',
		provider: 'Google',
	},
	{
		key: 'openrouterApiKey' as keyof UserApiKeys,
		label: 'OpenRouter API Key',
		placeholder: 'sk-or-...',
		provider: 'OpenRouter',
	},
	{
		key: 'groqApiKey' as keyof UserApiKeys,
		label: 'Groq API Key',
		placeholder: 'gsk_...',
		provider: 'Groq',
	},
];

interface ValidationResult {
	valid: boolean;
	creditInfo?: string;
	errorMessage?: string;
}

export const CredentialSection: React.FC<{ userId: string; userApiKeys: UserApiKeys }> = ({
	userId,
	userApiKeys,
}) => {
	const { addToast } = useToast();
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [originalValues, setOriginalValues] = useState<UserApiKeys>({});
	const [validationDialog, setValidationDialog] = useState<{
		open: boolean;
		validationResults: Record<string, ValidationResult>;
		pendingData: UserApiKeys;
	}>({ open: false, validationResults: {}, pendingData: {} });
	const [isValidating, setIsValidating] = useState(false);

	const { storeUserApiKeys, validateUserApiKeys } = useCredentialApi();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<UserApiKeys>({ defaultValues: userApiKeys });

	const watchedValues = useWatch({ control });

	// ✅ Get changed keys for validation
	const getChangedKeys = (currentData: UserApiKeys): UserApiKeys => {
		const changedKeys: UserApiKeys = {};
		API_KEY_CONFIG.forEach(({ key }) => {
			const original = (originalValues[key] || '').trim();
			const current = (currentData[key] || '').trim();
			if (original !== current && current !== '') {
				changedKeys[key] = current;
			}
		});
		return changedKeys;
	};

	useEffect(() => {
		if (userApiKeys && Object.keys(userApiKeys).length > 0) {
			reset(userApiKeys);
			setOriginalValues(userApiKeys);
		} else {
			const emptyKeys: UserApiKeys = {};
			reset(emptyKeys);
			setOriginalValues(emptyKeys);
		}
	}, [userApiKeys, reset]);

	const toggleVisibility = (keyType: string) => {
		setShowKeys((prev) => ({ ...prev, [keyType]: !prev[keyType] }));
	};

	// ✅ Validate only changed keys
	const validateChangedKeys = async (
		changedKeys: UserApiKeys
	): Promise<Record<string, ValidationResult>> => {
		if (Object.keys(changedKeys).length === 0) return {};

		try {
			const results = await validateUserApiKeys({ apiKeys: changedKeys });
			return results.validationResults;
		} catch (error) {
			console.error('Validation failed:', error);
			const errorResults: Record<string, ValidationResult> = {};
			Object.keys(changedKeys).forEach((key) => {
				errorResults[key] = {
					valid: false,
					errorMessage: getLangText(LANG_KEYS.VALIDATION_FAILED_NETWORK_ERROR), // ✅ Use language key
				};
			});
			return errorResults;
		}
	};

	// ✅ Pre-save validation flow
	const handleSaveApiKeys = async () => {
		await handleSubmit(async (data: UserApiKeys) => {
			const changedKeys = getChangedKeys(data);

			// If no changes, save directly
			if (Object.keys(changedKeys).length === 0) {
				await saveDirectly(data);
				return;
			}

			// Validate changed keys
			setIsValidating(true);
			try {
				const validationResults = await validateChangedKeys(changedKeys);

				// Check if all changed keys are valid
				const allValid = Object.values(validationResults).every((result) => result.valid);

				if (allValid) {
					// All valid - save directly
					await saveDirectly(data);
				} else {
					// Some invalid - show confirmation dialog
					setValidationDialog({ open: true, validationResults, pendingData: data });
				}
			} catch (error) {
				addToast(getLangText(LANG_KEYS.FAILED_TO_VALIDATE_API_KEYS), 'error');
			} finally {
				setIsValidating(false);
			}
		})();
	};

	// ✅ Direct save without validation
	const saveDirectly = async (data: UserApiKeys) => {
		try {
			const filteredData = Object.fromEntries(
				Object.entries(data).filter(([, value]) => value && value.trim() !== '')
			) as UserApiKeys;

			await storeUserApiKeys({ userId, apiKeys: filteredData });
			addToast(getLangAlertText(LANG_KEYS.API_KEYS_SAVED_SUCCESS), 'success');

			setOriginalValues(data);
			reset(data);
		} catch (error: any) {
			addToast(error.message || getLangAlertText(LANG_KEYS.API_KEYS_SAVE_FAILED), 'error');
		}
	};

	// ✅ Handle user's choice from validation dialog
	const handleValidationChoice = async (forceSave: boolean) => {
		setValidationDialog((prev) => ({ ...prev, open: false }));

		if (forceSave) {
			await saveDirectly(validationDialog.pendingData);
		}
		// If not force save, just close dialog and let user fix the keys
	};

	// ✅ Fixed approach using proper MUI sx styling
	const getFieldStyling = (fieldKey: keyof UserApiKeys): TextFieldProps => {
		const original = (originalValues[fieldKey] || '').trim();
		const current = (watchedValues[fieldKey] || '').trim();
		const isModified = original !== current;
		const hasValue = current !== '';

		if (isModified && hasValue) {
			return {
				helperText: getLangText(LANG_KEYS.MODIFIED),
				sx: {
					'& .MuiOutlinedInput-root': {
						'& fieldset': { borderColor: 'success.main', borderWidth: 2 },
						'&:hover fieldset': { borderColor: 'success.main' },
						'&.Mui-focused fieldset': { borderColor: 'success.main' },
					},
					'& .MuiInputLabel-root': { color: 'success.main' },
					'& .MuiFormHelperText-root': { color: 'success.dark', fontWeight: 700 },
				},
			};
		}

		if (!isModified && hasValue) {
			return {
				sx: {
					'& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'info.main' } },
					'& .MuiInputLabel-root': { color: 'info.main' },
					'& .MuiFormHelperText-root': { color: 'info.dark' },
				},
			};
		}

		return {};
	};

	return (
		<>
			<GlassCard variant="elevation">
				<Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
					{getLangText(LANG_KEYS.API_KEYS_DESCRIPTION)}
				</Alert>

				<Box>
					<Grid container spacing={2}>
						{API_KEY_CONFIG.map((config) => {
							const fieldStyling = getFieldStyling(config.key);

							return (
								<Grid size={{ xs: 12 }} key={config.key}>
									<Controller
										name={config.key}
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												{...fieldStyling}
												fullWidth
												label={config.label}
												placeholder={config.placeholder}
												type={showKeys[config.key] ? 'text' : 'password'}
												size="small"
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
							);
						})}
					</Grid>

					<Box display="flex" justifyContent="flex-end" mt={2}>
						<SolidMetallicButton
							onClick={handleSaveApiKeys}
							colorVariant="gold"
							disabled={isSubmitting || isValidating}
							loading={isSubmitting || isValidating}
							size="small"
						>
							{isValidating
								? getLangText(LANG_KEYS.VALIDATING)
								: isSubmitting
									? getLangText(LANG_KEYS.SAVING)
									: getLangText(LANG_KEYS.SAVE_API_KEYS)}
						</SolidMetallicButton>
					</Box>
				</Box>
			</GlassCard>

			{/* ✅ Validation Results Dialog */}
			<Dialog
				open={validationDialog.open}
				onClose={() => setValidationDialog((prev) => ({ ...prev, open: false }))}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>{getLangText(LANG_KEYS.API_KEY_VALIDATION_RESULTS)}</DialogTitle>{' '}
				{/* ✅ Use language key */}
				<DialogContent>
					<Box sx={{ mb: 2 }}>
						<Typography variant="body2" color="text.secondary" gutterBottom>
							{getLangText(LANG_KEYS.API_KEYS_VALIDATION_WARNING)} {/* ✅ Use language key */}
						</Typography>
					</Box>

					{Object.entries(validationDialog.validationResults).map(([key, result]) => {
						const config = API_KEY_CONFIG.find((c) => c.key === key);
						if (!config) return null;

						return (
							<Alert
								key={key}
								severity={result.valid ? 'success' : 'warning'}
								sx={{ mb: 1 }}
								icon={result.valid ? <CheckCircle /> : <Warning />}
							>
								<Typography variant="subtitle2">{config.provider}</Typography>
								<Typography variant="body2">
									{result.valid
										? result.creditInfo || getLangText(LANG_KEYS.API_KEY_IS_VALID) // ✅ Use language key
										: result.errorMessage || getLangText(LANG_KEYS.API_KEY_IS_INVALID)}
									{/* ✅ Use language key */}
								</Typography>
							</Alert>
						);
					})}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => handleValidationChoice(false)}>{getLangText(LANG_KEYS.CANCEL)}</Button>
					<Button onClick={() => handleValidationChoice(true)} variant="contained" color="warning">
						{getLangText(LANG_KEYS.SAVE_ANYWAY)}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};
