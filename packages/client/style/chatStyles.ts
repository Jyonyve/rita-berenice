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
		// Body colours match the reference reading app: a lighter indigo for user dialogue and
		// a more saturated amber for character action, both of which hold up better than the
		// previous pair now that the book background is sharp rather than blurred.
		userDialogue: '#818CF8',
		userAction: '#A3A3A3',
		assistantDialogue: '#FFFFFF',
		assistantAction: '#FFC200',
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
		// The book background is a plain veil, not a blur: the portrait behind it stays sharp
		// and --chat-text-shadow carries the extra separation. The veil opacity itself is
		// deliberately unchanged - lightening it to show more of the portrait was tried and
		// made the text hard to read.
		bookOverlay: 'rgba(248, 245, 238, 0.84)',
		bookBackdropFilter: 'none',
		// A second veil behind the input bar only. The portrait is sized with `cover`, so its
		// darkest region - clothing and shadow - usually lands at the bottom of the screen,
		// and 16% of that showing through the main veil is enough to read as a dark band under
		// light text chrome. Composited over bookOverlay this leaves roughly 7% of the
		// portrait visible there instead.
		bookInputVeil: 'rgba(248, 245, 238, 0.55)',
	},
	// Dark mode needs no extra veil: the portrait's dark bottom is what the theme wants there
	// anyway, and stacking a second layer made the input visibly darker than the chat area.
	dark: {
		bookOverlay: 'rgba(0, 0, 0, 0.6)',
		bookBackdropFilter: 'none',
		bookInputVeil: 'transparent',
	},
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
		textShadow: 'var(--chat-text-shadow)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.userAction': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		fontStyle: 'italic',
		color: 'var(--chat-action-color)',
		backgroundColor: 'transparent',
		textShadow: 'var(--chat-text-shadow)',
	},

	// Assistant message styles
	'.assistantDialogue': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		color: 'var(--chat-dialogue-color)',
		backgroundColor: 'transparent',
		textShadow: 'var(--chat-text-shadow)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.assistantAction': {
		...messageEntryBase,
		fontWeight: 'var(--chat-font-weight, 400)',
		fontStyle: 'italic',
		color: 'var(--chat-action-color)',
		backgroundColor: 'transparent',
		textShadow: 'var(--chat-text-shadow)',
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
