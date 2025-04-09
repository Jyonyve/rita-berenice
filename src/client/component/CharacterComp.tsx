import { Typography, CssBaseline, Button } from '@mui/material';
import { Box, Container, Stack } from '@mui/system';
import { useCharacter, useChromaChat } from '#root/src/client/hook/index.ts';

export const CharacterComp = () => {
	const { characters, loading, getCharacterAssets } = useCharacter();

	if (loading) {
		return <Typography>Loading characters...</Typography>;
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
			<CssBaseline />
			<Container maxWidth="sm">
				{characters.map(({ id, metadata }) => {
					const [character, variant] = id.split('-');
					const asset = getCharacterAssets(character, variant);
					return (
						<Box key={id} sx={{ mb: 3 }}>
							<Stack direction="row" spacing={2} alignItems="center">
								{asset && (
									<Box
										component="img"
										src={asset.defaultImage}
										alt={metadata.showName.toString()}
										sx={{ width: 48, height: 48, borderRadius: '50%' }}
									/>
								)}
								<Stack spacing={2}>
									<Typography variant="h6">{metadata.showName}</Typography>
									{/* {groupSessions.map((session) => (
										<Button key={session.uuId} variant="contained" onClick={() => navigate(session.id)}>
											{session.title}
										</Button>
									))} */}
								</Stack>
							</Stack>
						</Box>
					);
				})}
			</Container>
		</Box>
	);
};
