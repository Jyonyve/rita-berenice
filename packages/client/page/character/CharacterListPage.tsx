// src/client/component/page/CharacterListPage.tsx

import React from 'react';
import { Typography, Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router';
import { GlassCard, GlassPaper, GlassPortrait } from '../../layout/component/glass/index.js';
import { RomanticTitle } from '../../layout/component/index.js';
import { containerSpacing } from '../../style/index.js';
import { getDefaultImage } from '../../util/portraitUtils.js';
import { getLangText } from '../../util/translateUtils.js';
import { DEFAULT_CHARACTER_AVATAR, LANG_KEYS } from '@rita-berenice/shared/config';
import { CharacterInfo } from '@rita-berenice/shared/domain';

const characterCardSx = {
	display: 'flex',
	flexDirection: 'column',
	position: 'relative',
	height: '100%',
	zIndex: 1,
	'&:hover': {
		zIndex: 2, // Lifts card to prevent glow clipping, but no shadow on the card itself.
	},
};

const contentSx = {
	height: '100%',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'space-between',
	'&:last-child': { pb: 1 }, // Override MUI's default bottom padding
};

// Helper Component: CharacterItem now uses GlassCard
const CharacterItem: React.FC<{ characterInfo: CharacterInfo }> = ({ characterInfo }) => {
	const navigate = useNavigate();
	const defaultImage = getDefaultImage(characterInfo.characterId);
	const handleCharacterPage = () => {
		navigate(`${characterInfo.characterId}`);
	};

	return (
		<GlassCard
			sx={characterCardSx}
			role="button"
			onClick={handleCharacterPage}
			contentProps={{ sx: contentSx }}
		>
			<Box sx={{ width: '100%', display: 'flex', mb: 1 }}>
				{defaultImage ? (
					<GlassPortrait imageUrl={defaultImage} />
				) : (
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				)}
			</Box>
			<Box sx={{ mt: 'auto' }}>
				<RomanticTitle
					noGlow // Disable the title's own hover effect
					variant="h6"
					color="gold"
					colorVariant="gold" // Ensures the glow color is gold
				>
					{characterInfo.showName}
				</RomanticTitle>
				<Typography variant="body2" noWrap>
					{characterInfo.title}
				</Typography>
			</Box>
		</GlassCard>
	);
};

const NewCharacterItem = () => {
	const navigate = useNavigate();
	const handleNavigate = () => navigate('new');

	return (
		<GlassCard
			sx={characterCardSx}
			role="button"
			onClick={handleNavigate}
			contentProps={{ sx: { ...contentSx } }}
		>
			<Box sx={{ width: '100%', display: 'flex', mb: 1 }}>
				{/* Use GlassPortrait to display your new static image with consistent styling */}
				<GlassPortrait
					imageUrl={DEFAULT_CHARACTER_AVATAR} // Path to your image in the public folder
					alt="Add New Character"
					fit="contain" // Use 'contain' to ensure the whole icon is visible
					sx={{
						// Apply effects to make it dimmer and more transparent
						filter: 'brightness(0.8) saturate(0.8)', // Lower brightness and saturation
						opacity: 0.6, // Set transparency
					}}
				/>
			</Box>
			<Box sx={{ mt: 'auto' }}>
				<RomanticTitle noGlow variant="h6" color="silver" colorVariant="silver">
					{getLangText(LANG_KEYS.NEW_CHARACTER)}
				</RomanticTitle>
				<Typography variant="body2" noWrap>
					{getLangText(LANG_KEYS.NEW_CHARACTER_TITLE)}
				</Typography>
			</Box>
		</GlassCard>
	);
};
export const CharacterListPage = ({ characterInfos }: { characterInfos: CharacterInfo[] }) => {
	if (characterInfos.length === 0) {
		// Still provide the option to add a character if the list is empty
		return (
			<GlassPaper key="character-list-page" className="paper" sx={{ overflowY: 'auto' }}>
				<Grid container spacing={containerSpacing}>
					<Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
						<NewCharacterItem />
					</Grid>
				</Grid>
			</GlassPaper>
		);
	}

	return (
		<GlassPaper key="character-list-page" className="paper" sx={{ overflowY: 'auto' }}>
			<Grid container spacing={containerSpacing}>
				{characterInfos.map((characterInfo) => (
					<Grid key={characterInfo.characterId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
						<CharacterItem characterInfo={characterInfo} />
					</Grid>
				))}
				<Grid key={'add-new-character'} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
					<NewCharacterItem />
				</Grid>
			</Grid>
		</GlassPaper>
	);
};
