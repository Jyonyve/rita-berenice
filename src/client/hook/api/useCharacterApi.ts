// src/client/hooks/useCharacter.ts
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	CharacterResponse,
	CharacterInfo,
	CharacterCdo,
	ApiError,
	isCharacterInfo,
	METADATA_TYPES,
} from '@shared/index.ts';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../component/index.ts';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;

	// --- State ---
	const [characters, setCharacters] = useState<CharacterInfo[]>([]);
	const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo>();
	const [error, setError] = useState<ApiError | null>(null);
	const [loading, setLoading] = useState(false);
	const { addToast } = useToast();

	/**
	 * Fetches all characters from the server.
	 * On failure, shows an error toast and returns an empty array.
	 * @returns {Promise<CharacterInfo[]>} An array of characters, or an empty array on failure.
	 */
	const getAllCharacters = useCallback(async (): Promise<CharacterInfo[]> => {
		setLoading(true);
		setError(null);
		try {
			const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
			const response = await apiClient.get<CharacterResponse>(url);
			return response.data?.characterInfos || [];
		} catch (err) {
			const apiError = err as ApiError;
			addToast(apiError.clientMessage || 'Failed to load characters.', 'error');
			setError(apiError);
			return []; // Return an empty array on failure
		} finally {
			setLoading(false);
		}
	}, [addToast]);

	/**
	 * Fetches a single character by ID. Trusts the server to throw a 404 error if not found.
	 * On failure, it shows an error toast and returns null.
	 * @returns {Promise<CharacterResponse | null>} A CharacterResponse on success, or null on failure.
	 */
	const getCharacter = useCallback(
		async (characterId: string): Promise<CharacterResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getCharacter', [characterId]);
				const response = await apiClient.get<CharacterResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'An unknown error occurred.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	const getCharactersByShowName = useCallback(
		async (showName: string): Promise<CharacterResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getCharactersByShowName', [showName]);
				const response = await apiClient.get<CharacterResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to fetch characters by show', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Creates or updates a character.
	 * On success, shows a success toast. On failure, shows an error toast.
	 * @returns {Promise<StoreCharacterResponse | null>} A confirmation object on success, or null on failure.
	 */
	const storeCharacter = useCallback(
		async (character: CharacterCdo | CharacterInfo): Promise<string | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeCharacter');
				// The server returns a JSON string according to your store, so we expect a string.
				const response = await apiClient.post<string>(url, character);
				addToast('Character saved successfully.', 'success');
				return JSON.parse(response.data);
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save character.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	// state
	const updateAllCharacters = async () => {
		const allCharacters = await getAllCharacters();
		setCharacters(allCharacters);
	};

	const updateCurrentCharacter = async (characterId: string) => {
		const character = await getCharacter(characterId);
		character && setCurrentCharacter(character.characterInfo);
	};

	// --- Client-Side State Management ---
	useEffect(() => {
		if (!characters) {
			updateAllCharacters();
		}
	}, [characters]);

	return {
		characters,
		currentCharacter,
		loading,
		error,

		// API Methods
		getAllCharacters,
		getCharacter,
		getCharactersByShowName,
		storeCharacter,
		updateAllCharacters,
		updateCurrentCharacter,
	};
};
