import { FC, memo } from 'react';
import { FixedTurnDisplay } from './FixedTurnDisplay.jsx';
import { TempTurnDisplay } from './TempTurnDisplay.jsx';
import { DisplayTurn, TempChatTurn } from '@rita-berenice/shared/domain';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';

// The props interface is now much simpler.
// It receives the specific 'turn' to render, not the whole list.
export interface ChatLogRowProps {
	turn: DisplayTurn | TempChatTurn;
	isTemp: boolean; // Flag to determine which component to render
	isProcessing: boolean;
	currentTempSetNo: number;
	changeTempSetNo: (index: number) => void;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerateResponse: () => void;
	onUpdateFixedTurn: (sequence: number, userText: string, botText: string) => Promise<void>;
	onDeleteTurnsFromSequence: (sequence: number) => Promise<void>;
	displayMode: ChatDisplayMode;
	characterPortraitUrls?: PortraitUrlMap;
	characterAvatarUrls?: PortraitUrlMap;
	profileAvatarUrl?: string;
	localizeDirections?: boolean;
}

// Memoized: the log re-renders on scroll and on every streaming delta, and a row that
// re-renders makes Virtuoso re-measure its height, which visibly shifts the scroll position.
const ChatLogRow: FC<ChatLogRowProps> = memo(
	({
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
		onUpdateFixedTurn,
		onDeleteTurnsFromSequence,
		displayMode,
		characterPortraitUrls,
		characterAvatarUrls,
		profileAvatarUrl,
		localizeDirections,
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
					displayMode={displayMode}
					characterPortraitUrls={characterPortraitUrls}
					characterAvatarUrls={characterAvatarUrls}
					profileAvatarUrl={profileAvatarUrl}
					localizeDirections={localizeDirections}
				/>
			);
		}

		// Otherwise, it's a fixed historical turn.
		return (
			<FixedTurnDisplay
				turn={turn as DisplayTurn}
				onUpdateTurn={onUpdateFixedTurn}
				onDeleteFromHere={onDeleteTurnsFromSequence}
				displayMode={displayMode}
				characterPortraitUrls={characterPortraitUrls}
				characterAvatarUrls={characterAvatarUrls}
				profileAvatarUrl={profileAvatarUrl}
				localizeDirections={localizeDirections}
			/>
		);
	}
);

ChatLogRow.displayName = 'ChatLogRow';

export default ChatLogRow;
