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
		const { isScrolling, showTopGlow, showBottomGlow, scrollerRef, isScrollingChange } =
			useScrollEffect();

		// --- REFS ---
		const focusedTurnRef = useRef<number>(-1);
		const virtuosoRef = useRef<VirtuosoHandle>(null);
		const rangeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ This is what you need

		// Combine historical turns with the temporary turn for rendering
		const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

		// --- Handle turn focus changes ---
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

					console.log(`handleCharacterImage(emotion), turnIndex: ${turnIndex} ${emotion}`);
					handleCharacterImage(emotion);
				}
			},
			[allTurns, handleCharacterImage, rest.currentTempSetNo]
		);

		// --- Handle viewport range changes with debouncing ---
		const handleRangeChanged = useCallback(
			(range: { startIndex: number; endIndex: number }) => {
				console.log(`startIndex ${range.startIndex}, endIndex ${range.endIndex}`);

				// Clear any existing timeout
				if (rangeTimeoutRef.current) {
					clearTimeout(rangeTimeoutRef.current);
				}

				// Set a new timeout to process the range after it stabilizes
				rangeTimeoutRef.current = setTimeout(() => {
					if (range.startIndex < 0 || range.endIndex <= 0 || range.startIndex >= allTurns.length) {
						return;
					}

					if (range.startIndex >= range.endIndex) {
						if (range.startIndex === allTurns.length - 1) {
							handleTurnFocusChange(allTurns.length - 1);
						}
						return;
					}

					const lastTurnIndex = allTurns.length - 1;

					// Always focus on last turn when we're near the end
					if (range.startIndex >= lastTurnIndex - 1) {
						console.log(`Near end detected, focusing on last turn: ${lastTurnIndex}`);
						handleTurnFocusChange(lastTurnIndex);
					} else {
						// Focus on middle of visible range
						const actualEndIndex = Math.min(range.endIndex - 1, lastTurnIndex);
						const actualStartIndex = Math.max(range.startIndex, 0);
						const middleIndex = Math.floor((actualStartIndex + actualEndIndex) / 2);
						console.log(`Middle focus: ${middleIndex}`);
						handleTurnFocusChange(middleIndex);
					}
				}, 100); // 100ms debounce
			},
			[handleTurnFocusChange, allTurns.length]
		);

		// --- Initialize with the last turn ---
		useEffect(() => {
			if (allTurns.length > 0) {
				handleTurnFocusChange(allTurns.length - 1);
			}
		}, [allTurns.length, handleTurnFocusChange]);

		// --- Cleanup timeout on unmount ---
		useEffect(() => {
			return () => {
				if (rangeTimeoutRef.current) {
					clearTimeout(rangeTimeoutRef.current);
				}
			};
		}, []);

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
