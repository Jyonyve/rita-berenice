import { CharacterResponse } from '@rita-berenice/shared/api';
import {
	DEFAULT_CHARACTER_VISIBILITY,
	DEFAULT_LOCALIZE_DIRECTIONS,
	CHARACTER_VISIBILITY,
} from '@rita-berenice/shared/config';
import { CharacterCdo, CharacterInfo, ApiError } from '@rita-berenice/shared/domain';
import { createBasicCharacterInfo, isCharacterInfo } from '@rita-berenice/shared/util';
import { desc, eq, ilike } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { characters } from '../db/schema.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { getCharacterAvatarUrls, getCharacterPortraitUrls } from '../util/imageStorageUtils.js';

const normalizeCharacter = (character: CharacterInfo): CharacterInfo => ({
	...character,
	worldIntroduction: character.worldIntroduction ?? '',
	visibility: character.visibility ?? DEFAULT_CHARACTER_VISIBILITY,
	localizeDirections: character.localizeDirections ?? DEFAULT_LOCALIZE_DIRECTIONS,
});

const toResponse = async (rawCharacterInfos: CharacterInfo[]): Promise<CharacterResponse> => {
	const characterInfos = rawCharacterInfos.map(normalizeCharacter);
	const characterPortraits = Object.fromEntries(
		await Promise.all(
			characterInfos.map(async (character) => [
				character.characterId,
				await getCharacterPortraitUrls(character.characterId),
			])
		)
	);
	const characterAvatars = Object.fromEntries(
		await Promise.all(
			characterInfos.map(async (character) => [
				character.characterId,
				await getCharacterAvatarUrls(character.characterId),
			])
		)
	);

	return {
		characterInfos,
		characterInfo: characterInfos[0] || null,
		characterPortraits,
		characterAvatars,
	};
};

// Drops 'private' characters that do not belong to the requesting viewer so that
// visibility is enforced server-side regardless of client-side filtering.
export const filterCharacterResponseByViewer = (
	response: CharacterResponse,
	viewerUserId: string
): CharacterResponse => {
	const visibleInfos = response.characterInfos.filter(
		(character) =>
			character.userId === viewerUserId || character.visibility !== CHARACTER_VISIBILITY.PRIVATE
	);
	const visibleIds = new Set(visibleInfos.map((character) => character.characterId));
	return {
		...response,
		characterInfos: visibleInfos,
		characterInfo: visibleInfos[0] || null,
		characterPortraits: Object.fromEntries(
			Object.entries(response.characterPortraits).filter(([characterId]) =>
				visibleIds.has(characterId)
			)
		),
		characterAvatars: Object.fromEntries(
			Object.entries(response.characterAvatars).filter(([characterId]) => visibleIds.has(characterId))
		),
	};
};

// Throws 404 when the single requested character is private and the viewer is not its owner.
export const assertCharacterVisibleToUser = (
	response: CharacterResponse,
	viewerUserId: string
): CharacterResponse => {
	const character = response.characterInfo;
	if (!character) throw new ApiError(404, 'Character not found.');
	if (character.visibility === CHARACTER_VISIBILITY.PRIVATE && character.userId !== viewerUserId) {
		throw new ApiError(404, `Character '${character.characterId}' not found.`);
	}
	return response;
};

export const characterStore = {
	getAllCharacters: async (): Promise<CharacterResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: characters.data })
				.from(characters)
				.orderBy(desc(characters.updatedAt));
			return await toResponse(rows.map((row) => row.data));
		} catch (error) {
			handleServiceError(error, 'Failed to get all characters.');
		}
	},

	getCharacter: async (characterId: string): Promise<CharacterResponse> => {
		try {
			const [row] = await getDatabase()
				.select({ data: characters.data })
				.from(characters)
				.where(eq(characters.characterId, characterId))
				.limit(1);
			if (!row) throw new ApiError(404, `Character '${characterId}' not found.`);
			return await toResponse([row.data]);
		} catch (error) {
			handleServiceError(error, `Failed to get character with ID ${characterId}`);
		}
	},

	getCharactersByShowName: async (showName: string): Promise<CharacterResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: characters.data })
				.from(characters)
				.where(ilike(characters.showName, `%${showName}%`))
				.orderBy(desc(characters.updatedAt));
			return await toResponse(rows.map((row) => row.data));
		} catch (error) {
			handleServiceError(error, `Failed to get characters by showName '${showName}'`);
		}
	},

	getCharactersByUserId: async (userId: string): Promise<CharacterResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: characters.data })
				.from(characters)
				.where(eq(characters.userId, userId))
				.orderBy(desc(characters.updatedAt));
			return await toResponse(rows.map((row) => row.data));
		} catch (error) {
			handleServiceError(error, `Failed to get characters by userId '${userId}'`);
		}
	},

	storeCharacter: async (
		character: CharacterCdo | CharacterInfo
	): Promise<{ characterId: string }> => {
		const now = new Date().toISOString();
		const baseCharacter = isCharacterInfo(character)
			? character
			: createBasicCharacterInfo(character);
		const updatedCharacter: CharacterInfo = {
			...baseCharacter,
			worldIntroduction: baseCharacter.worldIntroduction ?? '',
			visibility: baseCharacter.visibility ?? DEFAULT_CHARACTER_VISIBILITY,
			localizeDirections: baseCharacter.localizeDirections ?? DEFAULT_LOCALIZE_DIRECTIONS,
			createdAt: baseCharacter.createdAt || now,
			updatedAt: now,
		};

		try {
			await getDatabase()
				.insert(characters)
				.values({
					characterId: updatedCharacter.characterId,
					userId: updatedCharacter.userId,
					showName: updatedCharacter.showName,
					data: updatedCharacter,
					createdAt: updatedCharacter.createdAt,
					updatedAt: updatedCharacter.updatedAt,
				})
				.onConflictDoUpdate({
					target: characters.characterId,
					set: {
						userId: updatedCharacter.userId,
						showName: updatedCharacter.showName,
						data: updatedCharacter,
						updatedAt: updatedCharacter.updatedAt,
					},
				});
			return { characterId: updatedCharacter.characterId };
		} catch (error) {
			handleServiceError(error, `Failed to store character '${updatedCharacter.characterId}'`);
		}
	},

	clearCollectionCache: (): void => {},
};
