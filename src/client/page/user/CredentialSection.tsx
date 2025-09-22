// src/client/component/user/CredentialSection.tsx
import { useEffect, useState } from 'react';
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
	CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Warning, Refresh } from '@mui/icons-material';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { GlassButton, GlassCard } from '../../layout/index.ts';
import { useCredentialApi } from '../../hook/api/useCredentialApi.ts';
import { useToast } from '../../provider/ToastProvider.tsx';
import { UserApiKeys, ValidationResult } from '#shared/domain/credential/CredentialInterfaces.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

// API Key configuration
const API_KEY_CONFIG = [
	{
		key: 'openrouterApiKey' as keyof UserApiKeys,
		label: 'OpenRouter API Key',
		placeholder: 'sk-or-...',
		provider: 'OpenRouter',
	},
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
		key: 'groqApiKey' as keyof UserApiKeys,
		label: 'Groq API Key',
		placeholder: 'gsk_...',
		provider: 'Groq',
	},
];

interface CredentialSectionProps {
	userId: string;
	userApiKeys: UserApiKeys;
	validationResults: Record<string, ValidationResult>; // ✅ Received from parent
	isValidating: boolean; // ✅ Received from parent
	onApiKeysUpdated: (keys: UserApiKeys) => Promise<void>; // ✅ Callback to parent
}

export const CredentialSection: React.FC<CredentialSectionProps> = ({
	userId,
	userApiKeys,
	validationResults, // ✅ Use parent validation results
	isValidating, // ✅ Use parent validation state
	onApiKeysUpdated, // ✅ Callback to parent
}) => {
	const { addToast } = useToast();
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [originalValues, setOriginalValues] = useState<UserApiKeys>({});
	const [validationDialog, setValidationDialog] = useState<{
		open: boolean;
		validationResults: Record<string, ValidationResult>;
		pendingData: UserApiKeys;
	}>({ open: false, validationResults: {}, pendingData: {} });
	const [isSaveValidating, setIsSaveValidating] = useState(false); // ✅ Only for pre-save validation

	const { storeUserApiKeys, validateUserApiKeys } = useCredentialApi();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<UserApiKeys>({ defaultValues: userApiKeys });

	const watchedValues = useWatch({ control });

	// ✅ Simple effect - no validation here
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

	// ✅ Validate only changed keys (for pre-save validation)
	const validateChangedKeys = async (
		changedKeys: UserApiKeys
	): Promise<Record<string, ValidationResult>> => {
		if (Object.keys(changedKeys).length === 0) return {};

		try {
			const results = await validateUserApiKeys({ apiKeys: changedKeys });
			return results.validationResults || {};
		} catch (error) {
			console.error('Validation failed:', error);
			const errorResults: Record<string, ValidationResult> = {};
			Object.keys(changedKeys).forEach((key) => {
				errorResults[key] = {
					valid: false,
					platform: 'direct',
					errorMessage: getLangText(LANG_KEYS.VALIDATION_FAILED_NETWORK_ERROR),
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
			setIsSaveValidating(true);
			try {
				const saveValidationResults = await validateChangedKeys(changedKeys);

				// Check if all changed keys are valid
				const allValid = Object.values(saveValidationResults).every((result) => result.valid);

				if (allValid) {
					// All valid - save directly
					await saveDirectly(data);
				} else {
					// Some invalid - show confirmation dialog
					setValidationDialog({
						open: true,
						validationResults: saveValidationResults,
						pendingData: data,
					});
				}
			} catch (error) {
				addToast(getLangText(LANG_KEYS.FAILED_TO_VALIDATE_API_KEYS), 'error');
			} finally {
				setIsSaveValidating(false);
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

			// ✅ Notify parent to re-validate with new data
			await onApiKeysUpdated(data);
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
	};

	// ✅ Enhanced field styling with validation results from parent
	const getFieldStyling = (fieldKey: keyof UserApiKeys): TextFieldProps => {
		const original = (originalValues[fieldKey] || '').trim();
		const current = (watchedValues[fieldKey] || '').trim();
		const isModified = original !== current;
		const hasValue = current !== '';
		const validationResult = validationResults[fieldKey]; // ✅ Use parent validation results

		if (isModified && hasValue) {
			// 🟢 Green: Modified and has value
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

		if (!isModified && hasValue && validationResult) {
			if (validationResult.valid) {
				// 🔵 Blue: Valid saved key
				return {
					helperText: validationResult.creditInfo || getLangText(LANG_KEYS.API_KEY_IS_VALID),
					sx: {
						'& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'info.main' } },
						'& .MuiInputLabel-root': { color: 'info.main' },
						'& .MuiFormHelperText-root': {
							color: 'info.dark',
							fontWeight: validationResult.creditInfo ? 700 : 400,
						},
					},
				};
			} else {
				// 🟠 Orange: Invalid saved key
				return {
					helperText: validationResult.errorMessage || getLangText(LANG_KEYS.API_KEY_IS_INVALID),
					sx: {
						'& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'warning.main', borderWidth: 1 } },
						'& .MuiInputLabel-root': { color: 'warning.main' },
						'& .MuiFormHelperText-root': { color: 'warning.dark' },
					},
				};
			}
		}

		if (!isModified && hasValue && isValidating) {
			// ⏳ Loading: Validating existing key
			return {
				helperText: getLangText(LANG_KEYS.VALIDATING),
				sx: { '& .MuiFormHelperText-root': { color: 'text.secondary' } },
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

				{/* ✅ Validation status summary - use parent validation results */}
				{Object.keys(validationResults).length > 0 && (
					<Box sx={{ mb: 2 }}>
						<Typography variant="caption" color="text.secondary">
							{`${Object.values(validationResults).filter((r) => r.valid).length}/${Object.keys(validationResults).length} keys valid`}
							{isValidating && ' (checking...)'}
						</Typography>
					</Box>
				)}

				<Box>
					<Grid container spacing={2}>
						{API_KEY_CONFIG.map((config) => {
							const fieldStyling = getFieldStyling(config.key);
							const validationResult = validationResults[config.key]; // ✅ Use parent results

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
																{/* ✅ Status icons using parent validation state */}
																{isValidating && field.value && <CircularProgress size={16} sx={{ mr: 1 }} />}
																{validationResult && !isValidating && (
																	<IconButton size="small" disabled sx={{ mr: 1 }}>
																		{validationResult.valid ? (
																			<CheckCircle sx={{ fontSize: 16, color: 'info.main' }} />
																		) : (
																			<Warning sx={{ fontSize: 16, color: 'warning.main' }} />
																		)}
																	</IconButton>
																)}
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
						<GlassButton
							onClick={handleSaveApiKeys}
							colorVariant="secondary"
							disabled={isSubmitting || isSaveValidating}
							loading={isSubmitting || isSaveValidating}
						>
							{isSaveValidating
								? getLangText(LANG_KEYS.VALIDATING)
								: isSubmitting
									? getLangText(LANG_KEYS.SAVING)
									: getLangText(LANG_KEYS.SAVE_API_KEYS)}
						</GlassButton>
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
				<DialogTitle>{getLangText(LANG_KEYS.API_KEY_VALIDATION_RESULTS)}</DialogTitle>
				<DialogContent>
					<Box sx={{ mb: 2 }}>
						<Typography variant="body2" color="text.secondary" gutterBottom>
							{getLangText(LANG_KEYS.API_KEYS_VALIDATION_WARNING)}
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
										? result.creditInfo || getLangText(LANG_KEYS.API_KEY_IS_VALID)
										: result.errorMessage || getLangText(LANG_KEYS.API_KEY_IS_INVALID)}
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
