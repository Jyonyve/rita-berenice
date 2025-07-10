// src/client/component/page/chat/ChatLogRow.tsx

import { FC, useRef, useEffect } from 'react';
import { ListChildComponentProps } from 'react-window';
import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { FixedTurnDisplay } from './FixedTurnDisplay.jsx';
import { TempTurnDisplay } from './TempTurnDisplay.jsx';

// Interface remains the same
export interface ChatLogRowData {
	chatTurns: ChatTurn[];
	tempChatTurn?: TempChatTurn;
	currentTempSetNo: number;
	changeTempSetNo: (index: number) => void;
	isProcessing: boolean;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
	setSize: (index: number, size: number) => void;
}

const ChatLogRow: FC<ListChildComponentProps<ChatLogRowData>> = ({ index, style, data }) => {
	const {
		chatTurns,
		tempChatTurn,
		currentTempSetNo,
		changeTempSetNo,
		isProcessing,
		onSaveTempTurnText: onEditTurn, // Assuming this is the correct prop for FixedTurnDisplay
		onRegenerateResponse,
		setSize,
		userEditInput,
		botEditInput,
		onEditTempTurnText,
		onSaveTempTurnText,
	} = data;

	// This ref is now on the inner div for accurate measurement
	const rowRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (rowRef.current) {
			setSize(index, rowRef.current.getBoundingClientRect().height);
		}
		// The dependency array needs to include all data to re-measure if content changes
	}, [index, setSize, data]);

	const isTempTurnRow = index === chatTurns.length && tempChatTurn;

	return (
		// This outer div gets the style from react-window (with position: absolute)
		<div style={style}>
			{/* This inner div wraps the content, allowing us to measure its true height */}
			<div ref={rowRef}>
				{isTempTurnRow ? (
					<TempTurnDisplay
						isProcessing={isProcessing}
						onRegenerate={onRegenerateResponse}
						tempTurn={tempChatTurn}
						currentTempSetNo={currentTempSetNo}
						changeTempSetNo={changeTempSetNo}
						userEditInput={userEditInput}
						botEditInput={botEditInput}
						onEditTempTurnText={onEditTempTurnText}
						onSaveTempTurnText={onSaveTempTurnText}
					/>
				) : (
					(() => {
						const turn = chatTurns[index];
						return turn ? <FixedTurnDisplay turn={turn} onEdit={() => onEditTurn()} /> : null;
					})()
				)}
			</div>
		</div>
	);
};

export default ChatLogRow;
