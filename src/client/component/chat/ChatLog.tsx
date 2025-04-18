// ChatLog.tsx
import React, { FC, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { ChatTurn, TempChatTurn } from '@shared/domain/index.ts';
// Removed TempTurnDisplay import here, it's used by ChatLogRow now
import styles from './ChatComp.module.scss';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
// Import the updated Row component and its data type
import ChatLogRow, { ChatLogRowData } from './ChatLogRow.tsx';

// --- Helper Hook for Dynamic Sizes ---
const useDynamicListSizes = () => {
	const listRef = useRef<List>(null);
	// Use Record<number, number> for the size map type
	const sizeMap = useRef<Record<number, number>>({}); // <<< UPDATED TYPE

	const setSize = useCallback((index: number, size: number) => {
		// Ensure size is a valid number before updating
		if (typeof size === 'number' && !isNaN(size) && sizeMap.current[index] !== size) {
			sizeMap.current = { ...sizeMap.current, [index]: size };
			// Check if listRef.current exists before calling resetAfterIndex
			if (listRef.current) {
				listRef.current.resetAfterIndex(index);
			}
		}
	}, []); // setSize depends only on refs, so empty dependency array is okay

	const getSize = useCallback((index: number) => {
		// Return cached size or a default estimate
		return sizeMap.current[index] ?? 100; // Default estimate: 100px
	}, []); // getSize depends only on ref, so empty dependency array is okay

	return { listRef, setSize, getSize };
};

// --- ChatLog Component ---
interface ChatLogProps {
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn;
	isLoadingHistory: boolean;
	isProcessing: boolean; // Still needed for itemData
	clientError?: string;
	credentialError?: Error;
	errorState?: string;
	onEditTurn: (turn: ChatTurn) => void;
	onRegenerateResponse: () => void; // Still needed for itemData
	onScroll: (event: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => void;
}

export const ChatLog: FC<ChatLogProps> = ({
	chatTurns,
	tempChatTurn,
	isLoadingHistory,
	isProcessing,
	clientError,
	credentialError,
	errorState,
	onEditTurn,
	onRegenerateResponse,
	onScroll,
}) => {
	const { listRef, setSize, getSize } = useDynamicListSizes();

	// Calculate itemCount including the potential temp turn
	const itemCount = chatTurns.length + (tempChatTurn ? 1 : 0);

	// Prepare itemData including tempTurn and related props/callbacks
	const itemData = React.useMemo<ChatLogRowData>(
		() => ({
			chatTurns,
			tempChatTurn, // Pass tempTurn down
			isProcessing, // Pass isProcessing down
			onEditTurn,
			onRegenerateResponse, // Pass regenerate callback down
			setSize,
		}),
		[chatTurns, tempChatTurn, isProcessing, onEditTurn, onRegenerateResponse, setSize]
	);

	return (
		<Box
			className={styles.logContainer}
			sx={{ flexGrow: 1, overflow: 'hidden', mb: 2, height: '100%', position: 'relative' }}
		>
			<AutoSizer>
				{({ height, width }) => (
					<>
						{/* ... isLoadingHistory indicator ... */}
						<List<ChatLogRowData>
							ref={listRef} // Assign the ref from the hook
							height={height}
							width={width}
							itemCount={itemCount}
							itemSize={getSize} // Use getSize from the hook
							itemData={itemData}
							onScroll={onScroll}
							overscanCount={5}
						>
							{ChatLogRow}
						</List>
					</>
				)}
			</AutoSizer>

			{/* Errors can remain below */}
			<Box sx={{ p: 1 }}>
				{errorState && <Typography color="error">{errorState}</Typography>}
				{clientError && <Typography color="error">{clientError}</Typography>}
				{credentialError && (
					<Typography color="error">Credential Error: {credentialError.message}</Typography>
				)}
			</Box>
		</Box>
	);
};
