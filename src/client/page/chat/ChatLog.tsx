import { Box, CircularProgress, Typography } from '@mui/material';
import React, { FC, memo, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { useScrollEffect } from '../../hook/useScrollEffect.js';
import { ScrollGlow } from '../../layout/ScrollGlow.jsx';
import ChatLogRow, { ChatLogRowProps } from './ChatLogRow.jsx'; // Import the props type as well

// The main component's props interface remains the same
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
		const {
			atTopStateChange,
			atBottomStateChange,
			isScrollingChange,
			showTopGlow,
			showBottomGlow,
			isScrolling,
		} = useScrollEffect();
		const virtuosoRef = useRef<VirtuosoHandle>(null); // Ref to control the Virtuoso instance

		// Combine historical turns with the temporary turn for rendering
		const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

		useEffect(() => {
			if (virtuosoRef.current && allTurns.length > 0) {
				// Use a short timeout to allow the final item to render and its height to be calculated
				const timer = setTimeout(() => {
					virtuosoRef.current?.scrollToIndex({
						index: allTurns.length - 1,
						align: 'end', // Align to the bottom of the item
						behavior: 'smooth',
					});
				}, 100);
				return () => clearTimeout(timer);
			}
		}, [allTurns.length]);

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
					atTopStateChange={atTopStateChange}
					atBottomStateChange={atBottomStateChange}
					isScrolling={isScrollingChange}
					// --- This is the corrected implementation ---
					itemContent={(index, turn) => {
						const isTemp = 'setCount' in turn; // Check if it's a TempChatTurn

						// The props are now passed individually to ChatLogRow
						const rowProps: ChatLogRowProps = {
							turn,
							isTemp,
							isProcessing: isTemp && isProcessing,
							...rest, // Pass all other necessary functions and state
						};

						return (
							// This Box provides the consistent padding for each row
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
