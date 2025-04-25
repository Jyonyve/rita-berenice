// src/client/hooks/useCharacter.ts
import {
	apiClient,
	CharacterInfo,
	CharacterAsset,
	genApiUrl,
	MODULE_NAMES,
} from '@shared/index.ts';
import { useCallback, useEffect, useState } from 'react';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;
	// --- State ---
	const [characters, setCharacters] = useState<CharacterInfo[]>([]);
	const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo | undefined>(undefined); // Use undefined initially
	const [loading, setLoading] = useState<boolean>(false); // Track loading state for all async operations

	// --- API Call Functions ---

	// Fetch all characters from the API
	const getAllCharacters = useCallback(async (): Promise<CharacterInfo[]> => {
		console.log('Fetching all characters from API...');
		setLoading(true);
		try {
			const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
			const response = await apiClient.get<CharacterInfo[]>(url);
			setCharacters(response.data);
			console.log('Fetched characters:', response.data);
			return response.data;
		} catch (error) {
			console.error('Failed to fetch characters from API:', error);
			setCharacters([]); // Clear on error
			return []; // Return empty array on error
		} finally {
			setLoading(false);
		}
	}, []); // No dependencies, safe for useCallback

	// Fetch a single character by ID from the API
	const getCharacterById = useCallback(async (id: string): Promise<CharacterInfo | null> => {
		console.log(`Fetching character by ID ${id} from API...`);
		setLoading(true);
		try {
			const url = genApiUrl(MODULE_NAME, 'getCharacterById', [id]);
			const response = await apiClient.get<CharacterInfo>(url); // Expect single CharacterInfo
			// Optionally update local state if needed, or just return
			return response.data;
		} catch (error: any) {
			console.error(`Failed to fetch character by ID ${id} from API:`, error);
			// Handle 404 specifically? Axios error object has response.status
			if (error.response?.status === 404) {
				console.log(`Character with ID ${id} not found.`);
				return null;
			}
			// Re-throw other errors or return null
			return null;
		} finally {
			setLoading(false);
		}
	}, []); // No dependencies

	// Store (create or update) a character via the API
	const storeCharacter = useCallback(
		async (characterData: CharacterInfo): Promise<CharacterInfo | null> => {
			console.log('Storing character via API:', characterData);
			setLoading(true);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeCharacter');
				// API expects full CharacterInfo, including ID for upsert
				const response = await apiClient.post<CharacterInfo>(url, characterData);
				console.log('Character stored successfully via API:', response.data);

				// Refresh the list after storing to ensure UI consistency
				await getAllCharacters(); // Call the refactored function

				return response.data; // Return the stored/updated character data from response
			} catch (error) {
				console.error('Failed to store character via API:', error);
				throw error; // Re-throw for component-level handling
			} finally {
				setLoading(false);
			}
		},
		[getAllCharacters] // Depends on getAllCharacters to refresh the list
	);

	// Query characters via API (Example - implement if needed)
	const queryCharacters = useCallback(
		async (query: string, limit: number = 10): Promise<CharacterInfo[]> => {
			console.log(`Querying characters with "${query}" from API...`);
			setLoading(true);
			try {
				const url = genApiUrl(MODULE_NAME, 'queryCharacters');
				const response = await apiClient.get<CharacterInfo[]>(url, { params: { q: query, limit } });
				console.log('Query results:', response.data);
				// Maybe update local state? Or just return results for specific use cases.
				return response.data;
			} catch (error) {
				console.error('Failed to query characters from API:', error);
				return []; // Return empty array on error
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	// --- Client-Side Logic ---

	// Initial fetch on mount
	useEffect(() => {
		getAllCharacters(); // Call the refactored function
	}, [getAllCharacters]); // Add getAllCharacters as dependency

	// Change current character based on selection (purely client-side state change)
	const changeCharacter = useCallback(
		(characterId: string) => {
			const characterInfo = characters.find((info) => info.id === characterId);
			if (characterInfo) {
				console.log(
					`Changing current character to: ${characterInfo.metadata?.name} (${characterInfo.id})`
				);
				setCurrentCharacter(characterInfo);
			} else {
				console.warn(`Character with ID ${characterId} not found in local state.`);
				// Optionally trigger a fetch? getCharacterById(characterId).then(setCurrentCharacter);
			}
		},
		[characters] // Depends on the local characters list
	);

	// Get character from local state (client-side lookup)
	const getCharacterFromState = useCallback(
		(characterId: string): CharacterInfo | undefined => {
			// Note: Renamed to avoid confusion with API call `getCharacterById`
			return characters.find((info) => info.id === characterId);
		},
		[characters]
	);

	// Get character assets (purely client-side using Vite's glob import)
	const getCharacterAssets = useCallback((character: string, variant: string): CharacterAsset => {
		const images = Object.entries(
			import.meta.glob<{ default: string }>('/src/asset/character/**/*.webp', {
				eager: true,
			}) as Record<string, { default: string }>
		);

		const filteredImages = images
			.filter(([path]) => path.includes(`/${character}-${variant}/`)) // Assumes folder naming convention
			.map(([_, module]) => module.default);

		return { images: filteredImages, defaultImage: filteredImages[0] || '' } as CharacterAsset;
	}, []); // No dependencies

	// --- Return Hook Values ---
	return {
		characters, // The list of all characters (local state)
		currentCharacter, // The currently selected character (local state)
		loading, // Loading indicator for API calls

		// API functions
		getAllCharacters, // Fetches all characters and updates state
		getCharacterById, // Fetches a single character by ID (doesn't update state directly, returns value)
		storeCharacter, // Creates/Updates a character via API and refreshes state
		queryCharacters, // Queries characters via API (returns results)

		// Client-side functions
		changeCharacter, // Sets the currentCharacter from local state
		getCharacterFromState, // Finds a character in the local state
		getCharacterAssets, // Gets asset paths
	};
};
