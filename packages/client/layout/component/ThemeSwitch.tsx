// Add to RootLayout.tsx, near LanguageSwitch

import { useColorMode } from '../../provider/index.js';
import { FC } from 'react';
import { Switch } from '@mui/material';
import { silver } from '../../style/colors.js';

export const ThemeSwitch: FC = () => {
	const { mode, toggleMode } = useColorMode();
	const isDark = mode === 'dark';
	const nextMode = isDark ? 'Light' : 'Dark';

	return (
		<Switch
			checked={isDark}
			onChange={toggleMode}
			role="switch"
			aria-checked={isDark}
			aria-label={`Switch to ${nextMode} mode`}
			color="default"
			size="medium"
			sx={(theme) => ({
				'& .MuiSwitch-thumb': {
					backgroundColor: isDark ? '#000' : '#fff', // Pitch black when dark, pure white when light
					boxShadow: isDark ? `0 0 8px ${silver.main}` : `0 0 8px ${theme.palette.secondary.main}`, // Use theme callback for secondary
					transition: 'box-shadow 0.3s ease-in-out, background-color 0.3s ease-in-out',
				},
			})}
		/>
	);
};
