import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { FC } from 'react';
import { FixedTurnDisplay } from './FixedTurnDisplay.jsx';
import { TempTurnDisplay } from './TempTurnDisplay.jsx';

// The props interface is now much simpler.
// It receives the specific 'turn' to render, not the whole list.
export interface ChatLogRowProps {
	turn: ChatTurn | TempChatTurn;
	isTemp: boolean; // Flag to determine which component to render
	isProcessing: boolean;
	currentTempSetNo: number;
	changeTempSetNo: (index: number) => void;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
}

const ChatLogRow: FC<ChatLogRowProps> = ({
	turn,
	isTemp,
	isProcessing,
	currentTempSetNo,
	changeTempSetNo,
	userEditInput,
	botEditInput,
	onEditTempTurnText,
	onSaveTempTurnText,
	onRegenerateResponse,
}) => {
	// All the logic for measuring height (useRef, useEffect, setSize) has been removed.
	// The complex wrapper divs have also been removed.

	if (isTemp) {
		// If it's a temporary turn, we render the TempTurnDisplay.
		// We safely cast the turn prop here.
		return (
			<TempTurnDisplay
				isProcessing={isProcessing}
				onRegenerate={onRegenerateResponse}
				tempTurn={turn as TempChatTurn}
				currentTempSetNo={currentTempSetNo}
				changeTempSetNo={changeTempSetNo}
				userEditInput={userEditInput}
				botEditInput={botEditInput}
				onEditTempTurnText={onEditTempTurnText}
				onSaveTempTurnText={onSaveTempTurnText}
			/>
		);
	}

	// Otherwise, it's a fixed historical turn.
	//TODO add onEdit
	return <FixedTurnDisplay turn={turn as ChatTurn} />;
};

export default ChatLogRow;
