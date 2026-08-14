import { Box } from '@mui/material';
import { FC } from 'react';
import { DisplayTurn } from '@rita-berenice/shared/domain';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';
import { getConversationAvatar } from './conversationAvatarUtils.js';
import { ConversationMessage } from './ConversationMessage.js';
import { ConversationEntry } from './ConversationEntry.js';

interface FixedTurnDisplayProps {
	turn: DisplayTurn;
	displayMode: ChatDisplayMode;
	characterPortraitUrls?: PortraitUrlMap;
	characterAvatarUrls?: PortraitUrlMap;
	profileAvatarUrl?: string;
}

export const FixedTurnDisplay: FC<FixedTurnDisplayProps> = ({
	turn,
	displayMode,
	characterPortraitUrls,
	characterAvatarUrls,
	profileAvatarUrl,
}) => {
	const isConversationMode = displayMode === 'conversation';
	const avatarUrl = getConversationAvatar(
		characterAvatarUrls,
		characterPortraitUrls,
		turn.response.emotion
	);

	return (
		<Box key={`${turn.sessionId}-${turn.sequence}`} className={'turnContainer'}>
			{isConversationMode ? (
				<>
					<ConversationMessage message={turn.request} role="user" avatarUrl={profileAvatarUrl} />
					<ConversationMessage message={turn.response} role="assistant" avatarUrl={avatarUrl} />
				</>
			) : (
				<>
					<Box sx={{ mb: 1 }}>
						{turn.request.entries.map((entry, idx) => (
							<Box key={`req-${turn.sequence}-${idx}`}>
								<ConversationEntry entry={entry} role="user" />
							</Box>
						))}
					</Box>
					<Box sx={{ mb: 1 }}>
						{turn.response.entries.map((entry, idx) => (
							<Box key={`res-${turn.sequence}-${idx}`}>
								<ConversationEntry entry={entry} role="assistant" />
							</Box>
						))}
					</Box>
				</>
			)}
		</Box>
	);
};
