import { styled, Switch, SwitchProps } from '@mui/material';
import { ComponentType } from 'react';
import { silver } from '../../style/colors.js';

export const AdultSwitch: ComponentType<SwitchProps> = styled(Switch)(({ theme }) => ({
	'& .MuiSwitch-switchBase.Mui-checked': {
		color: 'rgba(181, 57, 57, 0.92)',
		'& + .MuiSwitch-track': { backgroundColor: 'rgba(181, 57, 57, 0.82)' },
		'& .MuiSwitch-thumb': {
			backgroundColor: 'rgb(181, 57, 57)',
			boxShadow: `0 0 3px ${silver.main}, 0 0 8px ${silver.light}`,
		},
	},
	'& .MuiSwitch-thumb': {
		backgroundColor: '#fff',
		transition: theme.transitions.create(['background-color', 'box-shadow'], { duration: 300 }),
	},
}));
