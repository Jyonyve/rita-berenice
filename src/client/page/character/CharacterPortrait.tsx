import React, { FC } from 'react';
import { Box } from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

interface CharacterPortraitProps {
	imageUrl: string;
	characterInfo: CharacterInfo;
}

export const CharacterPortrait: FC<CharacterPortraitProps> = ({ imageUrl, characterInfo }) => {
	return (
		<Box
			component="img"
			src={imageUrl}
			alt={characterInfo.showName}
			sx={{
				// Styles from your original outer Box
				width: '100%',
				height: '100%',
				objectFit: 'cover',

				// Styles merged from your original inner <img>
				borderRadius: '8px',
				boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
			}}
		/>
	);
};
