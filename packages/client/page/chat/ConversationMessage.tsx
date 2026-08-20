import { Avatar, Box, Typography, alpha } from '@mui/material';
import type { ChatMessage, ChatRoleType } from '@rita-berenice/shared/domain';
import type { FC } from 'react';
import { GlassPaper } from '../../layout/component/glass/GlassPaper.js';
import { chatSurfaceStyles, getChatTextColors } from '../../style/chatStyles.js';
import { getGlassEffect } from '../../style/glassEffect.js';
import { ConversationEntry } from './ConversationEntry.js';

interface ConversationMessageProps {
	message: ChatMessage;
	role: ChatRoleType;
	avatarUrl?: string;
	localizeDirections?: boolean;
}

export const ConversationMessage: FC<ConversationMessageProps> = ({
	message,
	role,
	avatarUrl,
	localizeDirections,
}) => {
	const isUser = role === 'user';
	const avatarFallback = message.showName.trim().charAt(0).toUpperCase();

	return (
		<Box
			data-chat-side={isUser ? 'user' : 'npc'}
			sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1.5 }}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: isUser ? 'row-reverse' : 'row',
					alignItems: 'flex-start',
					gap: { xs: 1, sm: 1.25 },
					maxWidth: { xs: '94%', sm: '84%' },
					minWidth: 0,
				}}
			>
				<Avatar
					src={avatarUrl || undefined}
					alt={message.showName}
					sx={{ width: { xs: 48, sm: 56 }, height: { xs: 48, sm: 56 }, flexShrink: 0 }}
				>
					{avatarFallback}
				</Avatar>
				<Box sx={{ minWidth: 0 }}>
					<Typography
						variant="caption"
						sx={(theme) => ({
							display: 'block',
							mb: 0.5,
							textAlign: isUser ? 'right' : 'left',
							color: isUser
								? getChatTextColors(theme.palette.mode).userLabel
								: getChatTextColors(theme.palette.mode).assistantLabel,
						})}
					>
						{message.showName}
					</Typography>
					<GlassPaper
						sx={(theme) => {
							const glassEffect = getGlassEffect(theme.palette.mode, { noGlow: false });
							const useLightUserSurface = theme.palette.mode === 'light' && isUser;
							const userInteractionStyles = useLightUserSurface
								? {
										'&:hover': {
											...glassEffect['&:hover'],
											background: chatSurfaceStyles.light.userMessageHover,
										},
										'&:focus-within': {
											...glassEffect['&:focus-within'],
											background: chatSurfaceStyles.light.userMessageHover,
										},
										'&:active': {
											...glassEffect['&:active'],
											background: chatSurfaceStyles.light.userMessageHover,
										},
									}
								: {};

							return {
								...glassEffect,
								...userInteractionStyles,
								px: { xs: 1.25, sm: 1.5 },
								py: 1,
								borderRadius: 2,
								borderTopRightRadius: isUser ? 0.5 : 2,
								borderTopLeftRadius: isUser ? 2 : 0.5,
								background:
									theme.palette.mode === 'light'
										? isUser
											? chatSurfaceStyles.light.userMessage
											: chatSurfaceStyles.light.assistantMessage
										: isUser
											? alpha(theme.palette.primary.main, 0.12)
											: 'rgba(255, 255, 255, 0.07)',
							};
						}}
					>
						{message.entries.map((entry, index) => (
							<Box key={`${message.messageId}-${index}`} sx={{ mt: index === 0 ? 0 : 0.5 }}>
								<ConversationEntry entry={entry} role={role} localizeDirections={localizeDirections} />
							</Box>
						))}
					</GlassPaper>
				</Box>
			</Box>
		</Box>
	);
};
