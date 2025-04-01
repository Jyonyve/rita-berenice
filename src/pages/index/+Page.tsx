import { Box, CssBaseline, Container, Button } from '@mui/material';

import { navigate } from 'vike/client/router';

export function Page() {
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
			<CssBaseline />
			<Container maxWidth="sm">
				<Button onClick={() => navigate('/character')}></Button>
			</Container>
		</Box>
	);
}
