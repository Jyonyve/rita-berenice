import styles from './ChatComp.module.scss';
import { ChatRoleType, ChatType } from '@shared/domain/index.ts';

export const styleEntryFont = (role: ChatRoleType, type: ChatType): string => {
	if (role === 'user') {
		return type === 'dialogue' ? styles.userDialogue : styles.userAction;
	} else {
		// assistant
		return type === 'dialogue' ? styles.assistantDialogue : styles.assistantAction;
	}
};
