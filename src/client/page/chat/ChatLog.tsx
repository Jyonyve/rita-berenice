import { Box, CircularProgress, Typography } from '@mui/material';
import React, { FC, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { useScrollEffect } from '../../hook/useScrollEffect.js';
import ChatLogRow, { ChatLogRowProps } from './ChatLogRow.jsx';
import { ScrollGlow } from '../../layout/index.js';

interface ChatLogProps {
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn;
	currentTempSetNo: number;
	changeTempSetNo: (index: number) => void;
	isLoadingChat: boolean;
	isProcessing: boolean;
	clientError?: string;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
}

export const ChatLog: FC<ChatLogProps> = memo(
	({ chatTurns, tempChatTurn, isLoadingChat, isProcessing, clientError, ...rest }) => {
		// --- HOOKS ---
		const {
			isScrolling,
			showTopGlow,
			showBottomGlow,
			scrollerRef, // Now correctly typed as a callback function
			isScrollingChange,
		} = useScrollEffect();

		// Combine historical turns with the temporary turn for rendering
		const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

		if (isLoadingChat && allTurns.length === 0) {
			return (
				<Box display="flex" justifyContent="center" alignItems="center" height="100%">
					<CircularProgress />
				</Box>
			);
		}

		return (
			<Box sx={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
				<ScrollGlow showTop={showTopGlow} showBottom={showBottomGlow} isScrolling={isScrolling} />
				<Virtuoso
					style={{ height: '100%' }}
					data={allTurns}
					initialTopMostItemIndex={allTurns.length - 1}
					followOutput="auto"
					className="hide-scrollbar"
					// Direct DOM access with correct callback type
					scrollerRef={scrollerRef}
					isScrolling={isScrollingChange} // Fallback only
					itemContent={(index, turn) => {
						const isTemp = 'setCount' in turn;
						const rowProps: ChatLogRowProps = {
							turn,
							isTemp,
							isProcessing: isTemp && isProcessing,
							...rest,
						};
						return (
							<Box sx={{ py: 2, px: 1 }}>
								<ChatLogRow {...rowProps} />
							</Box>
						);
					}}
					components={{
						Footer: () =>
							clientError ? (
								<Typography color="error" sx={{ p: 1, textAlign: 'center' }}>
									{clientError}
								</Typography>
							) : null,
					}}
				/>
			</Box>
		);
	}
);
