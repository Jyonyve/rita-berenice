// Import types only for client-side usage
import type { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	CharacterInfo,
	AiCharacterMetadata,
	AiCharacterAsset,
} from '#root/src/client/domain/character';

const chromaUrl = import.meta.env.VITE_CHROMA_API_URL as string;

export const useCharacter = () => {
	// state
	const [characters, setCharacters] = useState<CharacterInfo[]>([]); // Keep state for fetched data
	const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo>();
	const [currentUser, setCurrentUser] = useState<CharacterInfo>();
	const [loading, setLoading] = useState(false);

	// Initial fetch only once when hook is mounted
	useEffect(() => {
		fetchCharacters();
	}, []); // Initial fetch on mount

	// Fetch characters from the API endpoint
	const fetchCharacters = useCallback(async () => {
		console.log('Fetching characters from API...');
		try {
			setLoading(true);
			const response = await fetch('/api/characters'); // GET request to our endpoint
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const charactersList: CharacterInfo[] = await response.json();
			setCharacters(charactersList);
			console.log('Fetched characters:', charactersList);
			return charactersList;
		} catch (error) {
			console.error('Failed to fetch characters from API:', error);
			setCharacters([]); // Clear characters on error
			return [];
		} finally {
			setLoading(false);
		}
	}, []); // No dependencies needed now

	// Create a character via the API endpoint
	const createCharacter = useCallback(
		async (newCharacter: CharacterInfo) => {
			console.log('Creating character via API:', newCharacter);
			try {
				setLoading(true);
				const response = await fetch('/api/characters', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(newCharacter),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({})); // Try to parse error
					throw new Error(
						`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`
					);
				}

				console.log('Character created successfully via API.');

				// Optimistic update or re-fetch: Re-fetch is simpler for now
				const updatedList = await fetchCharacters();

				// Find and set the newly created character
				const createdCharacter = updatedList.find((char) => char.id === newCharacter.id);
				if (createdCharacter) {
					setCurrentCharacter(createdCharacter);
				} else {
					console.warn('Created character not found in updated list');
					setCurrentCharacter(newCharacter);
				}

				return createdCharacter || newCharacter;
			} catch (error) {
				console.error('Failed to create character:', error);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[fetchCharacters] // Removed getCharactersList from dependency array
	);

	const changeCharacter = useCallback(
		(sessionId: string) => {
			const [character, variant] = sessionId.split('-');
			const characterInfo = characters.find(
				(info) => info.metadata.id === character && info.metadata.variant === variant
			);

			if (characterInfo) {
				setCurrentCharacter(characterInfo);
			}
		},
		[characters]
	);

	// Use memoized find instead of DB query
	const getCharacter = useCallback(
		(character: string, variant: string) => {
			return characters.find(
				(info) => info.metadata.id === character && info.metadata.variant === variant
			);
		},
		[characters]
	);

	const getCharacterAssets = useCallback((character: string, variant: string): AiCharacterAsset => {
		const images = import.meta.glob<{ default: string }>('/src/assets/character/**/*.webp', {
			eager: true,
		});

		const filteredImages = Object.entries(images)
			.filter(([path]) => path.includes(`/${character}-${variant}/`))
			.map(([_, module]) => module.default);

		return { images: filteredImages, defaultImage: filteredImages[0] || '' };
	}, []);

	return {
		characters,
		currentCharacter,
		loading,
		changeCharacter,
		getCharacterAssets,
		fetchCharacters,
		createCharacter,
		getCharacter,
	};
};
