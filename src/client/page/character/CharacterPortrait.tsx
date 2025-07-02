import React, { FC } from 'react';
import { Box } from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

interface CharacterPortraitProps {
	imageUrl: string;
	characterInfo: CharacterInfo;
	handleClick: () => void;
}

export const CharacterPortrait: FC<CharacterPortraitProps> = ({
	imageUrl,
	characterInfo,
	handleClick,
}) => {
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'flex-start',
				maxWidth: 300,
				width: '100%',
			}}
		>
			<img
				onClick={handleClick}
				src={imageUrl}
				alt={characterInfo.showName}
				style={{
					width: '100%',
					height: 'auto',
					maxHeight: '400px',
					borderRadius: '8px',
					objectFit: 'contain',
					boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
				}}
			/>
		</Box>
	);
};
