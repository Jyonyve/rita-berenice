import { Box, CircularProgress, Typography } from '@mui/material';
import React, { FC, memo, useCallback, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { useScrollEffect } from '../../hook/useScrollEffect.js';
import ChatLogRow, { ChatLogRowProps } from './ChatLogRow.jsx';
import { ScrollGlow } from '../../layout/index.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';

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
	handleCharacterImage: (emotion: string) => void;
}

export const ChatLog: FC<ChatLogProps> = memo(
	({
		chatTurns,
		tempChatTurn,
		isLoadingChat,
		isProcessing,
		clientError,
		handleCharacterImage,
		...rest
	}) => {
		// --- HOOKS ---
		const {
			isScrolling,
			showTopGlow,
			showBottomGlow,
			scrollerRef, // Now correctly typed as a callback function
			isScrollingChange,
		} = useScrollEffect();

		// --- NEW: Track focused turn ---
		const focusedTurnRef = useRef<number>(-1);
		const virtuosoRef = useRef<VirtuosoHandle>(null);

		// Combine historical turns with the temporary turn for rendering
		const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

		// --- NEW: Handle turn focus changes ---
		const handleTurnFocusChange = useCallback(
			(turnIndex: number) => {
				if (focusedTurnRef.current === turnIndex) return;

				focusedTurnRef.current = turnIndex;
				const turn = allTurns[turnIndex];

				if (turn) {
					let emotion: string = DEFAULT_EMOTION;

					// Extract emotion from the turn
					if ('setCount' in turn) {
						// TempChatTurn
						const currentSet = turn.chatTurnSets[rest.currentTempSetNo] || turn.chatTurnSets[0];
						emotion = currentSet?.response?.emotion || DEFAULT_EMOTION;
					} else {
						// ChatTurn
						emotion = turn.response?.emotion || DEFAULT_EMOTION;
					}
					console.log(`handleCharacterImage(emotion) ${emotion}`);
					handleCharacterImage(emotion);
				}
			},
			[allTurns, handleCharacterImage, rest.currentTempSetNo]
		);

		// --- NEW: Handle viewport range changes ---
		const handleRangeChanged = useCallback(
			(range: { startIndex: number; endIndex: number }) => {
				console.log(`startIndex ${range.startIndex}, endIndex ${range.endIndex}`);
				// Focus on the middle item in the current viewport
				const middleIndex = Math.floor((range.startIndex + range.endIndex) / 2);
				handleTurnFocusChange(middleIndex);
			},
			[handleTurnFocusChange]
		);

		// --- NEW: Initialize with the last turn ---
		useEffect(() => {
			if (allTurns.length > 0) {
				handleTurnFocusChange(allTurns.length - 1);
			}
		}, [allTurns.length, handleTurnFocusChange]);

		if (isLoadingChat && allTurns.length === 0) {
			return (
				<Box display="flex" justifyContent="center" alignItems="center" height="100%">
					<CircularProgress />
				</Box>
			);
		}

		return (
			<Box
				sx={{
					width: '100%',
					height: '100%',
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					minHeight: 0,
					py: 1,
				}}
			>
				<ScrollGlow showTop={showTopGlow} showBottom={showBottomGlow} isScrolling={isScrolling} />
				<Virtuoso
					style={{ height: '100%', width: '100%' }}
					data={allTurns}
					initialTopMostItemIndex={allTurns.length - 1}
					followOutput="auto"
					className="hide-scrollbar"
					// Direct DOM access with correct callback type
					scrollerRef={scrollerRef}
					isScrolling={isScrollingChange} // Fallback only
					rangeChanged={handleRangeChanged}
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
