import './assets/App.css';

import React from 'react';
import { Box, CssBaseline, Container } from '@mui/material';
import { ChatComp } from '@component/ChatComp'; // Importing Chat Component
import { AiModelComp } from '@component/AiModelComp'; // Importing AI Model Component

const App = () => {
	const sessionId = 'example-session-id'; // Replace with actual session ID

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
			<CssBaseline />
			<Container maxWidth="sm">
				<h1>AI Chat Application</h1>
				{/* AI Model Selector */}
				<AiModelComp model={'exaone-deep-2.4b'} sessionId={sessionId} />

				{/* Chat Component */}
				<ChatComp />
			</Container>
		</Box>
	);
};

export default App;
