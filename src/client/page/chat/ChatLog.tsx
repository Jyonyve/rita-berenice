// src/client/component/page/ChatLog.tsx

import React, { FC, useRef, useCallback, useEffect, memo } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import ChatLogRow, { ChatLogRowData } from './ChatLogRow.jsx';
import { useScrollEffect } from '../../hook/useScrollEffect.js'; // Import the new hook
import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { ScrollGlow } from '../../layout/ScrollGlow.jsx';
import { innerPadding } from '../../style/padding.js';

// --- Component-Specific Helper Hook ---
const useDynamicListSizes = (itemCount: number) => {
	const listRef = useRef<List>(null);
	const sizeMap = useRef<Record<number, number>>({});

	const setSize = useCallback((index: number, size: number) => {
		if (typeof size === 'number' && !isNaN(size) && sizeMap.current[index] !== size) {
			sizeMap.current = { ...sizeMap.current, [index]: size };
			listRef.current?.resetAfterIndex(index);
		}
	}, []);

	const getSize = useCallback((index: number) => sizeMap.current[index] ?? 150, []);

	useEffect(() => {
		if (listRef.current && itemCount > 0) {
			listRef.current.scrollToItem(itemCount - 1, 'end');
		}
	}, [itemCount]);

	return { listRef, setSize, getSize };
};

// --- Component Props Interface ---
interface ChatLogProps {
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn;
	currentTempSetNo: number;
	changeTempSetNo: (index: number) => void;
	isLoadingChat: boolean;
	hasMore: boolean;
	isProcessing: boolean;
	clientError?: string;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
	loadOlderMessages: () => void;
}

// --- Main Component ---
export const ChatLog: FC<ChatLogProps> = memo(
	({ chatTurns, tempChatTurn, loadOlderMessages, hasMore, isLoadingChat, clientError, ...rest }) => {
		// --- HOOKS ---
		const itemCount = chatTurns.length + (tempChatTurn ? 1 : 0);
		const { listRef, setSize, getSize } = useDynamicListSizes(itemCount);
		const { scrollContainerRef, handleScroll, showTopGlow, showBottomGlow, isScrolling } =
			useScrollEffect({ loadOlderMessages, hasMore, isLoadingChat });

		// --- MEMOIZED DATA ---
		const itemData = React.useMemo<ChatLogRowData>(
			() => ({ chatTurns, tempChatTurn, setSize, ...rest }),
			[chatTurns, tempChatTurn, setSize, rest]
		);

		// --- RENDER ---
		return (
			<>
				<ScrollGlow showTop={showTopGlow} showBottom={showBottomGlow} isScrolling={isScrolling} />
				<Box
					sx={{
						flexGrow: 1,
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

					<Box sx={{ flex: 1, width: '100%', height: '100%', py: 2 }}>
						<AutoSizer>
							{({ height, width }) => (
								<List<ChatLogRowData>
									ref={listRef}
									outerRef={scrollContainerRef}
									height={height}
									width={width}
									itemCount={itemCount}
									itemSize={getSize}
									itemData={itemData}
									onScroll={handleScroll}
									overscanCount={5}
									className="hide-scrollbar"
								>
									{ChatLogRow}
								</List>
							)}
						</AutoSizer>
					</Box>

					{clientError && (
						<Typography color="error" sx={{ p: 1, textAlign: 'center' }}>
							{clientError}
							<Button size="small" onClick={loadOlderMessages} disabled={isLoadingChat}>
								Retry
							</Button>
						</Typography>
					)}
				</Box>
			</>
		);
	}
);
