// src/styles/chatColors.ts

import type { PaletteMode } from '@mui/material';

/**
 * Chat component styles converted from ChatComp.module.scss
 * These styles define the appearance of user and assistant messages
 */

// Base message entry styles
const messageEntryBase = {
	display: 'block',
	marginBottom: 4,
	padding: '2px 5px',
	borderRadius: 4,
	fontSize: 'var(--chat-font-size, 1rem)',
};

const chatTextColors = {
	dark: {
		userLabel: '#00A9FF',
		assistantLabel: '#A0E9FF',
		userDialogue: '#0b8bda',
		userAction: '#989898',
		assistantDialogue: '#dcdcdc',
		assistantAction: '#daaa2e',
	},
	light: {
		userLabel: '#315F6B',
		assistantLabel: '#7A5A00',
		userDialogue: '#315F6B',
		userAction: '#625F58',
		assistantDialogue: '#3F3A34',
		assistantAction: '#7A5A00',
	},
} as const;

export const getChatTextColors = (mode: PaletteMode) => chatTextColors[mode];

export const chatSurfaceStyles = {
	light: {
		conversationCanvas: '#F6F1E6',
		userMessage: 'rgba(248, 245, 238, 0.72)',
		userMessageHover: 'rgba(255, 252, 246, 0.86)',
		assistantMessage: 'rgba(255, 252, 246, 0.58)',
		bookOverlay: 'rgba(248, 245, 238, 0.84)',
		bookBackdropFilter: 'blur(2px) saturate(0.78)',
	},
	dark: { bookOverlay: 'rgba(0, 0, 0, 0.6)', bookBackdropFilter: 'blur(2px)' },
} as const;

// Chat entry colors are supplied through element-scoped CSS variables so the
// hydrated client theme cannot conflict with the server-rendered theme.
export const chatStyles = {
	'.messageEntry': messageEntryBase,

	'.userDialogue': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		color: 'var(--chat-dialogue-color)',
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.userAction': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		fontStyle: 'italic',
		color: 'var(--chat-action-color)',
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
	},

	// Assistant message styles
	'.assistantDialogue': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		color: 'var(--chat-dialogue-color)',
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.assistantAction': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		fontStyle: 'italic',
		color: 'var(--chat-action-color)',
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
	},

	// Turn container with button positioning
	'.turnContainer': {
		paddingBottom: 15,
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
	},

	'.buttonGroup': {
		alignSelf: 'flex-end',
		display: 'flex',
		gap: 4,
		opacity: 0,
		transition: 'opacity 0.2s ease-in-out',
		marginTop: -20,
	},

	'.turnContainer:hover .buttonGroup': { opacity: 1 },
};
