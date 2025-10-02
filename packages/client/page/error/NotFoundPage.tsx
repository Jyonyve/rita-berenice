// src/client/component/page/NotFoundPage.tsx
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<Box
			display="flex"
			flexDirection="column"
			alignItems="center"
			justifyContent="center"
			minHeight="100vh"
			bgcolor="#f5f5f5"
		>
			<Typography variant="h1" color="primary" fontWeight={700} fontSize="8rem">
				404
			</Typography>
			<Typography variant="h5" color="textSecondary" mb={2}>
				Oops! The page you’re looking for doesn’t exist.
			</Typography>
			<Button variant="contained" color="primary" onClick={() => navigate('/')}>
				Go Home
			</Button>
		</Box>
	);
}
