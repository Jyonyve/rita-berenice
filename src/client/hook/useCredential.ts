// src/hooks/useCredential.ts
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../util/index.js';
import { MODULE_NAMES } from '#shared/config/constants.ts';
import { CredentialData } from '#shared/domain/chromadb/ChromaInterfaces.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';

/**
 * Custom hook to manage user credentials (API keys, etc.).
 * Handles fetching from and saving to the backend API using shared apiClient.
 */
export const useCredential = () => {
	const MODULE_NAME = MODULE_NAMES.CREDENTIAL;

	// --- State ---
	const [credential, setCredential] = useState<CredentialData>();
	const [isLoadingCredential, setIsLoadingCredential] = useState<boolean>(true); // Start loading initially
	const [credentialError, setCredentialError] = useState<Error>();

	// --- API Call Functions ---

	const loadCredential = useCallback(async (): Promise<void> => {
		setIsLoadingCredential(true);
		setCredentialError(undefined);
		try {
			const url = genApiUrl(MODULE_NAME, 'loadCredential'); // Or adjust based on genApiUrl needs
			const response = await apiClient.get<CredentialData>(url);
			setCredential(response.data);
			// console.log('useCredential: Credentials loaded:', response.data);
		} catch (err: any) {
			// Catch specific AxiosError if using Axios
			console.error('useCredential: Failed to load credentials:', err);
			// Extract meaningful error message (check Axios error structure if applicable)
			const message = err.response?.data?.message || err.message || 'An unknown error occurred';
			setCredentialError(new Error(message));
			setCredential(undefined); // Clear credentials on error
		} finally {
			setIsLoadingCredential(false);
		}
	}, []);

	const saveCredential = useCallback(async (secrets: CredentialData): Promise<boolean> => {
		// console.log('useCredential: Saving credentials...');
		setIsLoadingCredential(true);
		setCredentialError(undefined);
		let success = false;
		try {
			const url = genApiUrl(MODULE_NAME, 'saveCredential'); // Or adjust based on genApiUrl needs

			await apiClient.post(url, secrets);

			// Optimistic update local state immediately
			setCredential(secrets);
			console.info('useCredential: Credentials saved successfully.');
			success = true;
			// Optional: Reload after save for guaranteed consistency if needed
			await loadCredential();
		} catch (err: any) {
			console.error('useCredential: Failed to save credentials:', err);
			const message = err.response?.data?.message || err.message || 'An unknown error occurred';
			setCredentialError(new Error(message));
			// Keep optimistic update or revert? For settings, keeping it might be acceptable.
		} finally {
			setIsLoadingCredential(false);
		}
		return success;
	}, []); // Dependencies: apiClient, genApiUrl are assumed stable/global

	// --- Effects ---

	// Load credentials automatically when the hook is first mounted
	useEffect(() => {
		loadCredential();
	}, [loadCredential]); // Runs once when the hook mounts (and loadCredentials is stable)

	// --- Return Hook Values ---
	return { credential, isLoadingCredential, credentialError, loadCredential, saveCredential };
};
