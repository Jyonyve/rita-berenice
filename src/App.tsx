// import './assets/App.css';

import { Box, CssBaseline, Container } from '@mui/material';
import { AiModelComp } from '@component/AiModelComp';
import { ChatComp } from '@component/ChatComp';

const App = () => {
	const sessionId = 'example-session-id'; // Replace with actual session ID

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
			<CssBaseline />
			<Container maxWidth="sm">
				<h1>AI Chat Application</h1>
				{/* AI Model Selector */}
				<AiModelComp sessionId={sessionId} />

				{/* Chat Component */}
				<ChatComp />
			</Container>
		</Box>
	);
};

export default App;
