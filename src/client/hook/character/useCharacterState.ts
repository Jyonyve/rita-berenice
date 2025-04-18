import { useState, useEffect } from 'react';
import { loadNumberedPortraits } from '../../util/index.ts';

/**
 * Hook to load and manage portrait images for a specific character.
 *
 * @param characterId The ID of the character whose portraits to load.
 * @returns Object containing the portrait map, loading state, and default image URL.
 */
export function useCharacterState(characterId: string | null | undefined) {
	const [portraitMap, setPortraitMap] = useState<Record<number, string>>({});
	const [isLoadingPortraits, setIsLoadingPortraits] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Only load if characterId is provided
		if (!characterId) {
			setIsLoadingPortraits(false);
			setPortraitMap({}); // Clear map if no character selected
			return;
		}

		let isMounted = true;
		const loadPortraits = async () => {
			setIsLoadingPortraits(true);
			setError(null);
			try {
				console.log(`useCharacterPortraits: Loading portraits for ${characterId}`);
				const images = await loadNumberedPortraits(characterId);
				if (isMounted) {
					setPortraitMap(images);
					if (Object.keys(images).length === 0) {
						console.warn(`useCharacterPortraits: No portraits found for ${characterId}.`);
						setError(`No portrait images found for character ID: ${characterId}. Check asset path.`);
					} else {
						console.log(
							`useCharacterPortraits: Loaded ${Object.keys(images).length} portraits for ${characterId}.`
						);
					}
				}
			} catch (err) {
				console.error(`useCharacterPortraits: Failed to load portraits for ${characterId}`, err);
				if (isMounted) {
					setError(err instanceof Error ? err.message : 'Failed to load character images.');
				}
			} finally {
				if (isMounted) {
					setIsLoadingPortraits(false);
				}
			}
		};

		loadPortraits();

		// Cleanup function to prevent state updates on unmounted component
		return () => {
			isMounted = false;
		};
	}, [characterId]); // Dependency array includes characterId

	// Provide the default image URL directly if needed elsewhere (like CharacterPage)
	// Assumes DEFAULT_IMAGE_NUMBER is correctly defined and mapped
	// const defaultImageUrl = portraitMap[DEFAULT_IMAGE_NUMBER] ?? '';

	return { portraitMap, isLoadingPortraits, error };
	// Consider adding defaultImageUrl to the return if CharacterPage needs it directly
	// return { portraitMap, isLoadingPortraits, error, defaultImageUrl };
}
