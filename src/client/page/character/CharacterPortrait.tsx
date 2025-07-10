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
			display: 'block',

			// This shadow provides depth and a "beveled" edge feel.
			border: '1px solid rgba(255, 255, 255, 0.1)',
			boxShadow: `
				0px 4px 8px rgba(0, 0, 0, 0.3),          /* Outer shadow for depth */
				inset 1px 1px 2px rgba(255, 255, 255, 0.15) /* Inner highlight for a "shine" */
			`,

			'& img': { width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 'inherit' },
		}}
	/>
);
