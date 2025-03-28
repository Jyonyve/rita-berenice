import { Box, CssBaseline, Container } from '@mui/material';
import { AiModelComp } from '@component/AiModelComp';
import { ChatComp } from '@component/ChatComp';

export function Page() {
	const sessionId = 'example-session-id';

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
			<CssBaseline />
			<Container maxWidth="sm">
				<h1>AI Chat Application</h1>
				<AiModelComp sessionId={sessionId} />
				<ChatComp />
			</Container>
		</Box>
	);
}
