import { CharacterResponse } from '@rita-berenice/shared/api';
import { CharacterCdo, CharacterInfo, ApiError } from '@rita-berenice/shared/domain';
import { createBasicCharacterInfo, isCharacterInfo } from '@rita-berenice/shared/util';
import { desc, eq, ilike } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { characters } from '../db/schema.js';
import { handleServiceError } from '../util/serviceHelpers.js';

const toResponse = (characterInfos: CharacterInfo[]): CharacterResponse => ({
	ids: characterInfos.map((character) => character.characterId),
	documents: characterInfos.map((character) => character.description),
	metadatas: characterInfos.map(() => null),
	characterInfos,
	characterInfo: characterInfos[0] || null,
});

export const characterStore = {
	getAllCharacters: async (): Promise<CharacterResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: characters.data })
				.from(characters)
				.orderBy(desc(characters.updatedAt));
			return toResponse(rows.map((row) => row.data));
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
			return toResponse([row.data]);
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
			return toResponse(rows.map((row) => row.data));
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
			return toResponse(rows.map((row) => row.data));
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
