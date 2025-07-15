import { mockMondayChar } from '../data/mockCharacterData.js';
import { CharacterCdo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

/**
 * Mock implementation of the useCharacterApi hook for static builds.
 * This hook returns static data and simulates API calls without making network requests.
 */
export const useCharacterApiMock = () => {
	/**
	 * Mocks fetching all characters. Returns static data immediately.
	 */
	const getAllCharacters = () => ({
		data: mockMondayChar,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching a single character by ID. Ignores the ID and returns static data.
	 * @param {string} characterId - The ID of the character (ignored in mock).
	 */
	const getCharacter = (characterId: string) => ({
		data: mockMondayChar,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching characters by show name. Ignores the show name and returns static data.
	 * @param {string} showName - The name of the show (ignored in mock).
	 */
	const getCharactersByShowName = (showName: string) => ({
		data: mockMondayChar,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks the character creation/update mutation.
	 * This function simulates the `mutateAsync` function from React Query's `useMutation`.
	 * It logs the action to the console and returns a resolved promise with a mock ID.
	 * @param {CharacterCdo | CharacterInfo} character - The character data to be "stored".
	 */
	const storeCharacter = async (character: CharacterCdo | CharacterInfo): Promise<string> => {
		console.log('[MOCK] storeCharacter called with:', character);
		// Return a promise that resolves to a mock character ID string,
		// mimicking the successful response from the real API.
		return Promise.resolve('mock-character-id-12345');
	};

	return { getAllCharacters, getCharacter, getCharactersByShowName, storeCharacter };
};
