// ChatLogRow.tsx
import React, { FC, useRef, useEffect } from 'react';
import { ListChildComponentProps } from 'react-window';
import { ChatTurn, TempChatTurn } from '@shared/domain/index.ts';
import { FixedTurnDisplay, TempTurnDisplay } from './index.ts';

// Updated data interface: includes optional tempTurn and props for it
export interface ChatLogRowData {
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn; // Make tempTurn available
	currentTempSetNo?: number; // For FixedTurnDisplay
	changeTempSetNo: (index: number) => void;
	isProcessing: boolean; // Needed for TempTurnDisplay
	onEditTurn: (turn: ChatTurn) => void;
	onRegenerateResponse: () => void; // Needed for TempTurnDisplay
	setSize: (index: number, size: number) => void;
}

// Define the Row component as the default export
const ChatLogRow: FC<ListChildComponentProps<ChatLogRowData>> = ({ index, style, data }) => {
	const {
		chatTurns,
		tempChatTurn,
		currentTempSetNo,
		changeTempSetNo,
		isProcessing,
		onEditTurn,
		onRegenerateResponse,
		setSize,
	} = data;
	const rowRef = useRef<HTMLDivElement>(null);

	// Measure height after render and update cache
	useEffect(() => {
		if (rowRef.current) {
			setSize(index, rowRef.current.getBoundingClientRect().height);
		}
	}, [index, setSize]); // Depends only on index and stable setSize

	// Determine if this row is for the temp turn
	const isTempTurnRow = index === chatTurns.length && tempChatTurn;

	// Apply style and ref for measurement
	return (
		<div style={style} ref={rowRef}>
			{isTempTurnRow ? (
				// Render TempTurnDisplay if it's the last item and tempTurn exists
				<TempTurnDisplay
					isProcessing={isProcessing}
					onRegenerate={onRegenerateResponse}
					tempTurn={tempChatTurn}
					currentTempSetNo={currentTempSetNo ?? 0}
					changeTempSetNo={changeTempSetNo}
				/>
			) : (
				// Otherwise, render FixedTurnDisplay for regular turns
				(() => {
					const turn = chatTurns[index];
					// Render only if turn exists at this index (safety check)
					return turn ? <FixedTurnDisplay turn={turn} onEdit={onEditTurn} /> : null;
				})()
			)}
		</div>
	);
};

export default ChatLogRow;
