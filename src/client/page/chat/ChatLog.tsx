// ChatLog.tsx
import React, { FC, useRef, useCallback, useEffect, memo } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material'; // Added Button for retry
import { VariableSizeList as List, ListOnScrollProps } from 'react-window'; // Import ListOnScrollProps
import AutoSizer from 'react-virtualized-auto-sizer';
import ChatLogRow, { ChatLogRowData } from './ChatLogRow.jsx';
import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';

// --- Helper Hook for Dynamic Sizes (largely okay, minor tweak for initial scroll) ---
const useDynamicListSizes = (itemCountForScroll: number) => {
	// Pass itemCount for scroll logic
	const listRef = useRef<List>(null);
	const sizeMap = useRef<Record<number, number>>({});

	const setSize = useCallback((index: number, size: number) => {
		if (typeof size === 'number' && !isNaN(size) && sizeMap.current[index] !== size) {
			sizeMap.current = { ...sizeMap.current, [index]: size };
			if (listRef.current) {
				listRef.current.resetAfterIndex(index);
			}
		}
	}, []);

	const getSize = useCallback((index: number) => {
		return sizeMap.current[index] ?? 150; // Default estimate, adjust
	}, []);

	// Effect to scroll to bottom when itemCountForScroll (e.g., chatTurns.length + tempTurn) changes
	useEffect(() => {
		if (listRef.current && itemCountForScroll > 0) {
			listRef.current.scrollToItem(itemCountForScroll - 1, 'end');
		}
	}, [itemCountForScroll]); // Trigger when the relevant item count changes

	return { listRef, setSize, getSize };
};

// --- ChatLog Component Props ---
interface ChatLogProps {
	chatTurns: ChatTurn[]; // Sorted [oldest, ..., newest]
	tempChatTurn?: TempChatTurn;
	currentTempSetNo: number; // For FixedTurnDisplay
	changeTempSetNo: (index: number) => void;
	isLoadingChat: boolean; // From useChatState, for loading older messages
	hasMore: boolean; // From useChatState
	isProcessing: boolean; // From ChatPage, for temp turn processing indicator
	clientError?: string; // From useChatState
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
	loadOlderMessages: () => void; // Callback from ChatPage to trigger loading older
}

export const ChatLog: FC<ChatLogProps> = memo(
	({
		chatTurns,
		tempChatTurn,
		currentTempSetNo,
		changeTempSetNo,
		isLoadingChat,
		hasMore,
		isProcessing,
		clientError,
		userEditInput,
		botEditInput,
		onEditTempTurnText,
		onSaveTempTurnText,
		onRegenerateResponse,
		loadOlderMessages,
	}) => {
		const itemCount = chatTurns.length + (tempChatTurn ? 1 : 0);
		const { listRef, setSize, getSize } = useDynamicListSizes(itemCount); // Pass current total item count

		const itemData = React.useMemo<ChatLogRowData>(
			() => ({
				chatTurns,
				tempChatTurn,
				currentTempSetNo,
				changeTempSetNo,
				isProcessing,
				userEditInput,
				botEditInput,
				onEditTempTurnText,
				onSaveTempTurnText,
				onRegenerateResponse,
				setSize,
			}),
			[
				chatTurns,
				tempChatTurn,
				currentTempSetNo,
				changeTempSetNo,
				isProcessing,
				userEditInput,
				botEditInput,
				onEditTempTurnText,
				onSaveTempTurnText,
				onRegenerateResponse,
				setSize,
			]
		);

		// <<< --- SCROLL HANDLER FOR INFINITE LOAD --- >>>
		const handleScroll = useCallback(
			({ scrollOffset, scrollDirection }: ListOnScrollProps) => {
				// Trigger loading older messages when scrolling up and near the top
				// For lists where items are prepended, "top" means scrollOffset is small.
				if (scrollDirection === 'backward' && scrollOffset < 200 && hasMore && !isLoadingChat) {
					// console.log('ChatLog: Requesting older messages...');
					loadOlderMessages();
				}
			},
			[loadOlderMessages, hasMore, isLoadingChat]
		);

		return (
			<Box
				sx={{
					flexGrow: 1,
					overflow: 'hidden',
					height: '100%',
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{isLoadingChat && (
					<Box sx={{ textAlign: 'center', py: 1 }}>
						<CircularProgress size={24} /> Loading older...
					</Box>
				)}

				{/* This container now correctly uses flex-grow to fill remaining space */}
				<Box sx={{ flex: 1, width: '100%', height: '100%' }}>
					<AutoSizer>
						{({ height, width }) => (
							<List<ChatLogRowData>
								ref={listRef}
								height={height}
								width={width}
								itemCount={itemCount}
								itemSize={getSize}
								itemData={itemData}
								onScroll={handleScroll}
								overscanCount={5}
							>
								{ChatLogRow}
							</List>
						)}
					</AutoSizer>
				</Box>

				{clientError && (
					<Typography color="error" sx={{ p: 1, textAlign: 'center' }}>
						{clientError}{' '}
						<Button size="small" onClick={loadOlderMessages} disabled={isLoadingChat}>
							Retry
						</Button>
					</Typography>
				)}
			</Box>
		);
	}
);
