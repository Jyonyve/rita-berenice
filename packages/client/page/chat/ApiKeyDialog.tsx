import { useEffect, useMemo, useState } from 'react';
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	IconButton,
	InputAdornment,
	InputLabel,
	MenuItem,
	Select,
	TextField,
	Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import type { ApiKeyType } from '@rita-berenice/shared/domain';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useCredentialApi } from '../../hook/api/useCredentialApi.js';
import { useToast } from '../../provider/ToastProvider.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { API_KEY_CONFIG } from '../user/apiKeyConfig.js';
import { mobileVisualViewportDialogSx } from '../../style/mobileDialogStyles.js';

interface ApiKeyDialogProps {
	open: boolean;
	userId: string;
	onClose: () => void;
}

export function ApiKeyDialog({ open, userId, onClose }: ApiKeyDialogProps) {
	const { addToast } = useToast();
	const credentialApi = useCredentialApi();
	const { data } = credentialApi.getUserApiKeyMetadata(userId);
	const [keyType, setKeyType] = useState<ApiKeyType>('openrouterApiKey');
	const [keyValue, setKeyValue] = useState('');
	const [showKey, setShowKey] = useState(false);
	const [saving, setSaving] = useState(false);
	const config = useMemo(() => API_KEY_CONFIG.find((item) => item.key === keyType)!, [keyType]);
	const configured = data?.configuredKeyTypes.includes(keyType) ?? false;

	useEffect(() => {
		if (!open) {
			setKeyValue('');
			setShowKey(false);
		}
	}, [open]);

	const save = async () => {
		if (!keyValue.trim()) return;
		setSaving(true);
		try {
			await credentialApi.updateUserApiKey({ userId, keyType, keyValue: keyValue.trim() });
			setKeyValue('');
			addToast(getLangAlertText(LANG_KEYS.API_KEYS_SAVED_SUCCESS), 'success');
			onClose();
		} catch (error) {
			addToast(
				error instanceof Error ? error.message : getLangAlertText(LANG_KEYS.API_KEYS_SAVE_FAILED),
				'error'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={saving ? undefined : onClose}
			fullWidth
			maxWidth="xs"
			sx={mobileVisualViewportDialogSx}
		>
			<DialogTitle>{getLangText(LANG_KEYS.API_KEYS)}</DialogTitle>
			<DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
				<FormControl fullWidth size="small">
					<InputLabel id="api-key-provider-label">{getLangText(LANG_KEYS.PROVIDER)}</InputLabel>
					<Select
						labelId="api-key-provider-label"
						label={getLangText(LANG_KEYS.PROVIDER)}
						value={keyType}
						sx={{ '& .MuiSelect-select': { fontSize: { xs: '16px', md: 'inherit' } } }}
						onChange={(event) => {
							setKeyType(event.target.value as ApiKeyType);
							setKeyValue('');
						}}
					>
						{API_KEY_CONFIG.map((item) => (
							<MenuItem value={item.key} key={item.key}>
								{item.label}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<TextField
					autoFocus
					fullWidth
					size="small"
					label={`${config.label} API Key`}
					placeholder={config.placeholder}
					type={showKey ? 'text' : 'password'}
					value={keyValue}
					sx={{ '& .MuiInputBase-input': { fontSize: { xs: '16px', md: 'inherit' } } }}
					onChange={(event) => setKeyValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && keyValue.trim()) void save();
					}}
					slotProps={{
						input: {
							endAdornment: (
								<InputAdornment position="end">
									<IconButton
										onClick={() => setShowKey((current) => !current)}
										edge="end"
										aria-label={getLangText(LANG_KEYS.SHOW_API_KEY)}
									>
										{showKey ? <VisibilityOff /> : <Visibility />}
									</IconButton>
								</InputAdornment>
							),
						},
					}}
				/>
				<Typography variant="caption" color="text.secondary">
					{configured
						? 'A key is configured. Saving replaces it; the existing value cannot be viewed.'
						: 'No key is configured for this provider.'}
				</Typography>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					{getLangText(LANG_KEYS.CANCEL)}
				</Button>
				<Button onClick={save} disabled={saving || !keyValue.trim()} variant="contained">
					{saving ? getLangText(LANG_KEYS.SAVING) : getLangText(LANG_KEYS.SAVE_API_KEYS)}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
