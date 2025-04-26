// src/client/hooks/useCharacterState.ts

import { useState, useEffect, useRef } from 'react'; // Removed useCallback unless needed elsewhere at top level
// Correctly import the utility function
import { loadNumberedPortraits, PortraitMap } from '../../util/index.ts';
// CharacterAsset might not be needed here if not returned/used
// import { CharacterAsset } from '#root/src/shared/index.ts';

/**
 * Hook to load and manage numbered portrait images for a specific character.
 * Assumes assets are bundled client-side and uses loadNumberedPortraits.
 *
 * @param characterId The ID of the character (e.g., "monday-original"). Can be null/undefined.
 * @returns Object containing the portrait map, loading state, and any error message.
 */
// Ensure types for state are set correctly
export const useCharacterState = (characterId?: string) => {
	// --- Hooks called at TOP LEVEL (Correct) ---
	const [portraitMap, setPortraitMap] = useState<PortraitMap>({}); // Use PortraitMap type
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null); // Use string | null for error message
	const loadingRef = useRef<string | null>(null);

	// --- useEffect Hook (Correct) ---
	useEffect(() => {
		// --- Logic INSIDE useEffect ---

		// Reset state if characterId is cleared
		if (!characterId) {
			setPortraitMap({});
			setIsLoading(false);
			setError(null);
			loadingRef.current = null;
			console.log('[useCharacterState] Character ID cleared, resetting state.');
			return;
		}

		// --- REMOVED INVALID HOOK CALL ---
		// const getCharacterAssets = useCallback(...) // DELETED THIS BLOCK

		// --- Fetch portraits logic remains ---
		const loadPortraits = async () => {
			if (loadingRef.current === characterId) {
				console.log(
					`[useCharacterState] Load already in progress for ${characterId}, skipping duplicate request.`
				);
				return;
			}
			console.log(`[useCharacterState] Initiating portrait load for ${characterId}`);
			loadingRef.current = characterId;
			setIsLoading(true);
			setError(null);
			setPortraitMap({});

			try {
				// Correctly call the imported utility function
				const images = await loadNumberedPortraits(characterId);
				console.log(images);
				// Race Condition Check
				if (loadingRef.current === characterId) {
					setPortraitMap(images);
					if (Object.keys(images).length === 0) {
						const errMsg = `No portrait images found for character ID: ${characterId}. Check asset path/naming.`;
						console.warn(`[useCharacterState] ${errMsg}`);
						setError(errMsg);
					} else {
						console.log(
							`[useCharacterState] Successfully loaded ${Object.keys(images).length} portraits for ${characterId}.`
						);
						setError(null);
					}
					setIsLoading(false);
					loadingRef.current = null;
				} else {
					console.log(
						`[useCharacterState] Discarding stale portrait results for ${characterId} (now loading ${loadingRef.current}).`
					);
				}
			} catch (err) {
				console.error(`[useCharacterState] Failed to load portraits for ${characterId}`, err);
				if (loadingRef.current === characterId) {
					setError(err instanceof Error ? err.message : 'Failed to load character images.');
					setIsLoading(false);
					setPortraitMap({});
					loadingRef.current = null;
				} else {
					console.log(
						`[useCharacterState] Discarding stale error for ${characterId} (now loading ${loadingRef.current}).`
					);
				}
			}
		};

		loadPortraits();
	}, [characterId]); // Dependency array is correct

	// --- Return statement (Correct) ---
	return { portraitMap, isLoadingPortraits: isLoading, error };
};
