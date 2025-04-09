import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	CharacterInfo,
	CharacterMetadata,
	CharacterAsset,
} from '#root/src/client/domain/character';

const chromaUrl = import.meta.env.VITE_CHROMA_API_URL as string;

export const useCharacter = () => {
	//
	const client = useMemo(() => new ChromaClient({ path: chromaUrl }), []);

	// state
	const [characters, setCharacters] = useState<CharacterInfo[]>([]);
	const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo>();
	const [loading, setLoading] = useState(false);

	// Initial fetch only once when hook is mounted
	useEffect(() => {
		fetchCharacters();
	}, []);

	const getCharactersList = useCallback(async (): Promise<Collection> => {
		return await client.getOrCreateCollection({ name: 'characters' });
	}, [client]);

	const fetchCharacters = useCallback(async () => {
		try {
			setLoading(true);
			const collection = await getCharactersList();
			const result = await collection.get({ include: [IncludeEnum.Metadatas, IncludeEnum.Documents] });

			const charactersList: CharacterInfo[] = result.ids.map((id, index) => ({
				id,
				metadata: result.metadatas[index] as CharacterMetadata,
			}));

			setCharacters(charactersList);
			return charactersList;
		} catch (error) {
			console.error('Failed to fetch characters:', error);
			return [];
		} finally {
			setLoading(false);
		}
	}, [getCharactersList]);

	const createCharacter = useCallback(
		async (newCharacter: CharacterInfo) => {
			try {
				setLoading(true);
				const collection = await getCharactersList();

				// Add new character
				await collection.add({
					ids: [newCharacter.id],
					metadatas: [newCharacter.metadata],
					documents: [JSON.stringify(newCharacter.metadata)],
				});

				// Fetch updated list
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
		[getCharactersList, fetchCharacters]
	);

	const changeCharacter = useCallback(
		(sessionId: string) => {
			const [character, variant] = sessionId.split('-');
			const characterInfo = characters.find(
				(info) => info.metadata.character === character && info.metadata.variant === variant
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
				(info) => info.metadata.character === character && info.metadata.variant === variant
			);
		},
		[characters]
	);

	const getCharacterAssets = useCallback((character: string, variant: string): CharacterAsset => {
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
