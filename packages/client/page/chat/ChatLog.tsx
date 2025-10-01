import { Box, CircularProgress, Typography } from '@mui/material';
import React, { FC, memo, useCallback, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { DisplayTurn, TempChatTurn } from '@rita-berenice/shared/domain/chat/chat.type.js';
import { useScrollEffect } from '../../hook/useScrollEffect.js';
import ChatLogRow, { ChatLogRowProps } from './ChatLogRow.jsx';
import { GlassCircularProgress, ScrollGlow } from '../../layout/index.js';

interface ChatLogProps {
	allTurns: (DisplayTurn | TempChatTurn)[];
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
	shouldUseMobileLayout: boolean;
	focusedTurnIndex: number; // Receive the focused index
	onFocusTurn: (index: number) => void; // Receive the handler
}

export const ChatLog: FC<ChatLogProps> = memo(
	({
		allTurns,
		isLoadingChat,
		isProcessing,
		clientError,
		shouldUseMobileLayout,
		onFocusTurn,
		...rest
	}) => {
		// --- HOOKS ---
		const { isScrolling, showTopGlow, showBottomGlow, scrollerRef, isScrollingChange } =
			useScrollEffect();

		// --- REFS ---
		const virtuosoRef = useRef<VirtuosoHandle>(null);
		const rangeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ This is what you need

		// --- Handle viewport range changes with debouncing ---
		const handleRangeChanged = useCallback(
			(range: { startIndex: number; endIndex: number }) => {
				if (rangeTimeoutRef.current) clearTimeout(rangeTimeoutRef.current);

				rangeTimeoutRef.current = setTimeout(() => {
					const lastTurnIndex = allTurns.length - 1;
					if (lastTurnIndex < 0) return;

					let newFocusIndex = -1;
					if (range.startIndex >= lastTurnIndex - 1) {
						newFocusIndex = lastTurnIndex;
					} else {
						const actualEndIndex = Math.min(range.endIndex - 1, lastTurnIndex);
						const actualStartIndex = Math.max(range.startIndex, 0);
						newFocusIndex = Math.floor((actualStartIndex + actualEndIndex) / 2);
					}

					if (newFocusIndex !== -1) {
						onFocusTurn(newFocusIndex); // Call the parent's handler
					}
				}, 100);
			},
			[allTurns.length, onFocusTurn]
		);

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
					<GlassCircularProgress colorVariant="silver" />
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
				<ScrollGlow
					showTop={showTopGlow}
					showBottom={showBottomGlow}
					isScrolling={isScrolling}
					shouldUseMobileLayout={shouldUseMobileLayout}
				/>
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
							<Box sx={{ py: 1, px: 1 }}>
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
