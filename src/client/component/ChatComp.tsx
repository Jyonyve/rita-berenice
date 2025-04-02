import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, ChatEntry } from '#root/src/client/domain/chat';

import { buildChatMessage, parseTextToEntries } from '#root/src/client/util/chatConvertUtils';
import { useAiModel } from '#root/src/client/hook/useAiModel';
import { MessageContent } from '@langchain/core/messages';
import { useCallback, useEffect, useState } from 'react';
import { useChat } from '#root/src/client/hook/useChat';

import { useChromaChat } from '#root/src/client/hook/useChromaChat';
import { Box, Button, Divider, TextField, Typography } from '@mui/material';

const DEFAULT_QUERY_LIMIT = import.meta.env.VITE_QUERY_LIMIT;
const SUMMARY_INTERVAL = import.meta.env.VITE_SUMMARY_INTERVAL;

export const ChatComp = () => {
	// state
	const [userText, setUserText] = useState<string>();
	const [isTyping, setIsTyping] = useState<boolean>();
	const [currentPrompt, setCurrentPrompt] = useState<string>();
	const [currentUserChatMsg, setCurrentUserChatMsg] = useState<ChatMessage>();
	const [currentCharChatMsg, setCurrentCharChatMsg] = useState<ChatMessage>();

	// hook
	const { aiModelInfo } = useAiModel();
	const { recentChatTurn, currentSessionId, changeSessionId, getResponseFromLlm, saveChatTurn } =
		useChat();

	const { buildUserPromptFromLog, storeChatTurn, storeSummary, getSummary, queryChatLog } =
		useChromaChat(currentSessionId, aiModelInfo.model);

	// function
	const handleUserText = (text: string) => {
		// user enter there chat
		if (!currentSessionId) throw new Error('No active session.');
		setUserText(text);
	};

	const handleUserChatMsg = async (userText: string) => {
		// build user chat message
		if (!currentSessionId) throw new Error('No active session.');
		const userChatMsg = buildChatMessage('user', userText, currentSessionId);
		setCurrentUserChatMsg(userChatMsg);

		const prompt = await buildUserPromptFromLog(userText);
		setCurrentPrompt(prompt);

		genLlmResponse(prompt);
	};

	const genLlmResponse = async (prompt: string): Promise<string> => {
		const response = await getResponseFromLlm(prompt);
		const charChatMsg = buildChatMessage('assistant', response, currentSessionId);
		setCurrentCharChatMsg(charChatMsg);
		return response;
	};

	const handleSendUserChatMsg = () => {
		setIsTyping(false);
	};

	const handleReloadAiChat = () => {
		if (!currentPrompt) throw new Error('No current user prompt.');
		genLlmResponse(currentPrompt);
	};

	//	Effect
	useEffect(() => {
		if (!userText && !isTyping) {
			setIsTyping(true);
		} else if (userText && !isTyping) {
			handleUserChatMsg(userText);
		}
	}, [isTyping, userText]);

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', width: 400, margin: 'auto' }}>
			<Typography variant="h5" gutterBottom>
				Chat
			</Typography>
			<Box sx={{ overflowY: 'auto', maxHeight: 400, marginBottom: 2 }}>
				{recentChatTurn.map((turn) => (
					<Box key={turn.sequence} sx={{ marginBottom: 1 }}>
						<Typography variant="body1" color={'primary'}>
							<strong>{turn.request.speaker}:</strong> {turn.request.entries.join('\n')}
						</Typography>
						<Typography variant="body1" color={'text.secondary'}>
							<strong>{turn.response.speaker}:</strong> {turn.response.entries.join('\n')}
						</Typography>
					</Box>
				))}
			</Box>
			<Divider />
			<TextField
				value={userText}
				onChange={(e) => handleUserText(e.target.value)}
				label="Your message"
				variant="outlined"
				fullWidth
				sx={{ marginBottom: 2 }}
			/>
			<Button onClick={handleSendUserChatMsg} variant="contained" color="primary" fullWidth>
				Send Message
			</Button>
		</Box>
	);
};
