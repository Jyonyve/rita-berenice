// src/client/hooks/useCharacter.ts
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	BasicCharacterInfo,
	CharacterResponse,
} from '@shared/index.ts';
import { useCallback, useEffect, useState } from 'react';
import { CharacterMetadata } from '@shared/index.ts';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;

	// --- State ---
	const [characters, setCharacters] = useState<BasicCharacterInfo[]>([]);
	const [currentCharacter, setCurrentCharacter] = useState<BasicCharacterInfo>();
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>('');

	// --- API Response Handlers ---
	const handleCharacterResponse = (response: CharacterResponse): BasicCharacterInfo[] => {
		if (!response || !response.basicCharacterInfos?.length) {
			throw new Error('No characters found in response');
		}
		return response.basicCharacterInfos;
	};

	// --- API Call Functions ---
	const getAllCharacters = useCallback(async (): Promise<BasicCharacterInfo[]> => {
		setLoading(true);
		setError('');
		try {
			const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
			const response = await apiClient.get<CharacterResponse>(url);
			const basicCharacterInfos = handleCharacterResponse(response.data);
			setCharacters(basicCharacterInfos);
			return basicCharacterInfos;
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Failed to fetch characters');
			return [];
		} finally {
			setLoading(false);
		}
	}, []);

	const getCharacterById = useCallback(async (id: string): Promise<BasicCharacterInfo | null> => {
		setLoading(true);
		setError('');
		try {
			const url = genApiUrl(MODULE_NAME, 'getCharacter', [id]);
			const response = await apiClient.get<CharacterResponse>(url);

			if (!response.data?.basicCharacterInfo) {
				throw new Error('Character not found');
			}

			setCurrentCharacter(response.data.basicCharacterInfo);
			return response.data.basicCharacterInfo;
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Failed to fetch character');
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const getCharactersByShowName = useCallback(
		async (showName: string): Promise<BasicCharacterInfo[]> => {
			setLoading(true);
			setError('');
			try {
				const url = genApiUrl(MODULE_NAME, 'getCharactersByShowName', [showName]);
				const response = await apiClient.get<CharacterResponse>(url);
				return handleCharacterResponse(response.data);
			} catch (error) {
				setError(error instanceof Error ? error.message : 'Failed to fetch characters by show');
				return [];
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const storeCharacter = useCallback(
		async (characterData: CharacterMetadata): Promise<CharacterMetadata> => {
			setLoading(true);
			setError('');
			try {
				const url = genApiUrl(MODULE_NAME, 'storeCharacter');
				const response = await apiClient.post<CharacterMetadata>(url, characterData);

				// Update local state
				setCharacters((prev) => {
					const existing = prev.find((c) => c.characterId === response.data.characterId);
					return existing
						? prev.map((c) => (c.characterId === response.data.characterId ? response.data : c))
						: [...prev, response.data];
				});

				return response.data;
			} catch (error) {
				setError(error instanceof Error ? error.message : 'Failed to store character');
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	// --- Client-Side State Management ---
	useEffect(() => {
		getAllCharacters();
	}, [getAllCharacters]);

	const updateLocalCharacter = useCallback((updated: BasicCharacterInfo) => {
		setCharacters((prev) => prev.map((c) => (c.characterId === updated.characterId ? updated : c)));
		setCurrentCharacter((prev) => (prev?.characterId === updated.characterId ? updated : prev));
	}, []);

	return {
		characters,
		currentCharacter,
		loading,
		error,

		// API Methods
		getAllCharacters,
		getCharacterById,
		getCharactersByShowName,
		storeCharacter,

		// Local State Management
		updateLocalCharacter,
		setCurrentCharacter,
	};
};
