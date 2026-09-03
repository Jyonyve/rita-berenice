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
  localizeDirections?: boolean;
}

export const ConversationEntry: FC<ConversationEntryProps> = ({ entry, role, localizeDirections }) => {
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
      localizeDirections={localizeDirections}
      className={styleEntryFont(role, hasEmbeddedActions ? 'dialogue' : entry.type)}
      style={chatColorVariables}
      sx={{
        // The entry classes declare these same variables in global CSS, but the
        // Typography root's own variant styles (body1: 1rem/400) are injected after
        // them and win the cascade at equal specificity. Passing them through sx
        // merges them into the Typography rule itself, where they are declared last
        // and therefore apply.
        fontSize: 'var(--chat-font-size, 1rem)',
        fontWeight: 'var(--chat-font-weight, 400)',
      }}
    />
  );
};
