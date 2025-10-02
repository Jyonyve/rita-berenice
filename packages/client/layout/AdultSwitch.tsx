import { styled, Switch, SwitchProps } from '@mui/material';
import { ComponentType, FC } from 'react';
import { gold, silver } from '../style/colors.js';

// --- SVG Icons ---
// The 'off' state icon with white text.
const adultIconOffSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <text x="50%" y="45%" dominant-baseline="central" text-anchor="middle" font-size="14" font-weight="bold" fill="#c7c7c7ff">
      19
    </text>
  </svg>
`;
const encodedAdultIconOff = `url("data:image/svg+xml,${encodeURIComponent(adultIconOffSvg)}")`;

// The 'on' state icon with red text.
const adultIconOnSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <text x="50%" y="45%" dominant-baseline="central" text-anchor="middle" font-size="14" font-weight="bold" fill="#efefefff">
      19
    </text>
  </svg>
`;
const encodedAdultIconOn = `url("data:image/svg+xml,${encodeURIComponent(adultIconOnSvg)}")`;
export const AdultSwitch: ComponentType<SwitchProps> = styled(Switch)(({ theme }) => ({
	width: 42,
	height: 26,
	padding: 0,
	display: 'flex',
	alignItems: 'center',

	'& .MuiSwitch-switchBase': {
		padding: 0,
		margin: 2,
		transitionDuration: '300ms',
		// 'On' (checked) state
		'&.Mui-checked': {
			transform: 'translateX(16px)',
			'& + .MuiSwitch-track': {
				// --- 1. Dimmed background when ON ---
				// Using a darker grey from the theme palette to make it recede
				backgroundColor:
					theme.palette.mode === 'light' ? theme.palette.grey[400] : theme.palette.grey[800],
				opacity: 1,
				border: 0,
			},
			'& .MuiSwitch-thumb': {
				backgroundImage: encodedAdultIconOn,

				backgroundColor: 'rgba(181, 57, 57, 0.7)', // 70 opacity
				// The glow effect remains the same
				boxShadow: `0 0 3px ${silver.main}, 0 0 8px ${silver.light}`,
			},
		},
	},

	'& .MuiSwitch-thumb': {
		boxSizing: 'border-box',
		width: 22,
		height: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		backgroundImage: encodedAdultIconOff,
		backgroundRepeat: 'no-repeat',
		backgroundPosition: 'center',
		backgroundSize: '80%',
		boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
		// Add 'box-shadow' to the transition for a smooth glow animation
		transition: theme.transitions.create(['background-color', 'box-shadow'], { duration: 300 }),
	},

	'& .MuiSwitch-track': {
		width: 38,
		height: 14,
		borderRadius: 7,
		backgroundColor: theme.palette.mode === 'light' ? '#E9E9EA' : '#39393D',
		transition: theme.transitions.create(['background-color'], { duration: 500 }),
	},
}));
