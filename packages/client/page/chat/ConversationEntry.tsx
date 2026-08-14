import { useTheme } from '@mui/material';
import type { ChatEntry, ChatRoleType } from '@rita-berenice/shared/domain';
import type { CSSProperties, FC } from 'react';
import { SafeRichText } from '../../layout/component/SafeRichText.js';
import { getChatTextColors } from '../../style/chatStyles.js';
import { containsEmbeddedRoleplayAction } from '../../util/conversationMarkupUtils.js';
import { styleEntryFont } from '../../util/styleUtils.jsx';

interface ConversationEntryProps {
	entry: ChatEntry;
	role: ChatRoleType;
}

export const ConversationEntry: FC<ConversationEntryProps> = ({ entry, role }) => {
	const theme = useTheme();
	const hasEmbeddedActions = containsEmbeddedRoleplayAction(entry.prompt);
	const colors = getChatTextColors(theme.palette.mode);
	const chatColorVariables = {
		'--chat-dialogue-color': role === 'user' ? colors.userDialogue : colors.assistantDialogue,
		'--chat-action-color': role === 'user' ? colors.userAction : colors.assistantAction,
	} as CSSProperties;

	return (
		<SafeRichText
			text={entry.prompt}
			role={role}
			localizeNarrativeDirections
			className={styleEntryFont(role, hasEmbeddedActions ? 'dialogue' : entry.type)}
			style={chatColorVariables}
		/>
	);
};
