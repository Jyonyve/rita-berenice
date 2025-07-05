import React, { FC } from 'react';
import Avatar from '@mui/material/Avatar';

interface CharacterPortraitProps {
	imageUrl: string;
	alt?: string;
}

export const CharacterPortrait: FC<CharacterPortraitProps> = ({ imageUrl, alt = 'Character' }) => (
	<Avatar
		src={imageUrl}
		alt={alt}
		variant="rounded"
		sx={{
			width: '100%',
			height: 'auto',
			borderRadius: 3,
			boxShadow: 3,
			'& img': {
				width: '100%',
				height: 'auto',
				objectFit: 'cover', // or 'contain' if you want to avoid cropping
				borderRadius: 'inherit',
			},
			// backgroundColor: '#f5f5f5', // fallback bg
			display: 'block',
		}}
	/>
);
