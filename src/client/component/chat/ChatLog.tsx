import React, { FC, RefObject } from 'react';
import { Box, Typography } from '@mui/material';
import { ChatTurn, TempChatTurn } from '@shared/domain/index.ts';
import styles from './ChatComp.module.scss';
import { FixedTurnDisplay, TempTurnDisplay } from './index.ts';

interface ChatLogProps {
	logRef: RefObject<HTMLDivElement | null>;
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn;
	isLoadingHistory: boolean;
	isProcessing: boolean; // Needed for TempTurnDisplay
	clientError?: string; // Or specific error type
	credentialError?: Error; // Or specific error type
	errorState?: string; // From ChatPage state
	onEditTurn: (turn: ChatTurn) => void;
	onRegenerateResponse: () => void;
}

export const ChatLog: FC<ChatLogProps> = ({
	logRef,
	chatTurns,
	tempChatTurn,
	isLoadingHistory,
	isProcessing,
	clientError,
	credentialError,
	errorState,
	onEditTurn,
	onRegenerateResponse,
}) => {
	return (
		<Box
			ref={logRef}
			className={styles.logContainer}
			sx={{
				flexGrow: 1, // Take available space
				overflowY: 'auto', // Make it scrollable
				mb: 2, // Margin bottom before input area
			}}
		>
			{/* Loading indicators */}
			{isLoadingHistory && (
				<Typography align="center" sx={{ my: 1 }}>
					Loading older messages...
				</Typography>
			)}

			{/* Render Fixed Chat Turns */}
			{chatTurns.map((turn) => (
				<FixedTurnDisplay key={`${turn.sessionId}-${turn.sequence}`} turn={turn} onEdit={onEditTurn} />
			))}

			{/* Render Temporary Chat Turn */}
			{tempChatTurn && (
				<TempTurnDisplay
					tempTurn={tempChatTurn}
					isProcessing={isProcessing}
					onRegenerate={onRegenerateResponse}
				/>
			)}

			{/* Display Errors */}
			{errorState && (
				<Typography color="error" sx={{ mt: 1 }}>
					{errorState}
				</Typography>
			)}
			{clientError && (
				<Typography color="error" sx={{ mt: 1 }}>
					{clientError}
				</Typography>
			)}
			{credentialError && (
				<Typography color="error" sx={{ mt: 1 }}>
					Credential Error: {credentialError.message}
				</Typography>
			)}
		</Box>
	);
};
