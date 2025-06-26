import React, { FC } from 'react';
import { Box } from '@mui/material';

interface CharacterPortraitProps {
	imageUrl: string;
	charName?: string;
}

export const CharacterPortrait: FC<CharacterPortraitProps> = ({ imageUrl, charName }) => {
	console.log(imageUrl);
	const altText = charName ? `${charName}_portrait` : 'portrait';
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
				src={imageUrl}
				alt={altText}
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
