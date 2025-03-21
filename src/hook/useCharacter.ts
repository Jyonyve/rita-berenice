import { CharacterInfo } from '@domain/character';
import { axiosCharacter } from '@util/axiosUtils';
import { useEffect, useState } from 'react';
export const useCharacter = () => {
	// state
	const [characterInfoList, setCharacterInfoList] = useState<CharacterInfo[]>([]); //TODO: get whole character info list from DB
	const [currentCharacterInfo, setCurrentCharacterInfo] = useState<CharacterInfo>();

	// function
	// function to change character info by session ID
	const changeCharacterInfo = (sessionId: string) => {
		const characterInfo = characterInfoList.find((info) => info.sessionId === sessionId);
		if (characterInfo) {
			setCurrentCharacterInfo(characterInfo);
		} else {
			console.error('Character info not found for session ID:', sessionId);
		}
	};

	// Fetch character info list from the database
	const fetchCharacterInfoList = async () => {
		try {
			const response = await axiosCharacter.get<CharacterInfo[]>('');
			setCharacterInfoList(response.data);
		} catch (error) {
			console.error('Error fetching character info list:', error);
		}
	};

	// initialization
	useEffect(() => {
		fetchCharacterInfoList();
	}, []);

	return { currentCharacterInfo, changeCharacterInfo, fetchCharacterInfoList };
};
