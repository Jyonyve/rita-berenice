import { CharacterInfo } from '#root/src/client/domain';
import { axiosCharacter } from '#root/src/client/util';

export const characterService = {
	async getAllCharacterList(): Promise<CharacterInfo[]> {
		try {
			const response = await axiosCharacter.get('/get');
			return response.data;
		} catch (error) {
			console.error('Failed to fetch characters:', error);
			return [];
		}
	},

	async addnewCharacter(character: CharacterInfo): Promise<void> {
		await axiosCharacter.post('/add', { character });
	},
};
