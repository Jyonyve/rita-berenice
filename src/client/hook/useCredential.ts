// src/hooks/useCredential.ts
import { useState, useCallback, useEffect } from 'react';
import { apiClient, genApiUrl, MODULE_NAMES, CredentialData } from '@shared/index.ts'; // Adjust import path

/**
 * Custom hook to manage user credentials (API keys, etc.).
 * Handles fetching from and saving to the backend API using shared apiClient.
 */
export const useCredential = () => {
	const MODULE_NAME = MODULE_NAMES.CREDENTIAL;

	// --- State ---
	const [credential, setCredential] = useState<CredentialData>();
	const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
	const [error, setError] = useState<Error>();

	// --- API Call Functions ---

	const loadCredential = useCallback(async (): Promise<void> => {
		setIsLoading(true);
		setError(undefined);
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
			setError(new Error(message));
			setCredential(undefined); // Clear credentials on error
		} finally {
			setIsLoading(false);
		}
	}, []);

	const saveCredential = useCallback(async (secrets: CredentialData): Promise<boolean> => {
		// console.log('useCredential: Saving credentials...');
		setIsLoading(true);
		setError(undefined);
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
			setError(new Error(message));
			// Keep optimistic update or revert? For settings, keeping it might be acceptable.
		} finally {
			setIsLoading(false);
		}
		return success;
	}, []); // Dependencies: apiClient, genApiUrl are assumed stable/global

	// --- Effects ---

	// Load credentials automatically when the hook is first mounted
	useEffect(() => {
		loadCredential();
	}, [loadCredential]); // Runs once when the hook mounts (and loadCredentials is stable)

	// --- Return Hook Values ---
	return { credential, isLoading, error, loadCredential, saveCredential };
};
