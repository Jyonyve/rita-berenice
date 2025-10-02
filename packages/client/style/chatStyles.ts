// src/styles/chatColors.ts

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
	fontSize: '0.8rem',
};

// User message styles
export const chatStyles = {
	'.messageEntry': messageEntryBase,

	'.userDialogue': {
		...messageEntryBase,
		fontWeight: 'bold',
		color: '#0b8bda', // Darker shade of SteelBlue
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.userAction': {
		...messageEntryBase,
		fontWeight: 'bold',
		fontStyle: 'italic',
		color: '#989898',
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
	},

	// Assistant message styles
	'.assistantDialogue': {
		...messageEntryBase,
		fontWeight: 'bold',
		color: '#dcdcdc', // Brighter shade of gray
		backgroundColor: 'transparent',
		textShadow: '1px 1px 3px rgba(0, 0, 0, 0.15)',
		paddingBottom: '1em',
		paddingTop: '1em',
	},

	'.assistantAction': {
		...messageEntryBase,
		fontWeight: 'bold',
		fontStyle: 'italic',
		color: '#daaa2e',
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
