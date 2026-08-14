import { FC } from 'react';
import { useLanguage } from '../../provider/LanguageProvider.js';
import { alpha, Switch } from '@mui/material';
import { silver } from '../../style/colors.js';

export const LanguageSwitch: FC = () => {
	const { lang, toggleLang } = useLanguage();
	const isKor = lang === 'kor';
	const next = isKor ? 'English' : 'Korean';

	return (
		<Switch
			checked={isKor}
			onChange={toggleLang}
			// ARIA switch semantics
			role="switch"
			aria-checked={isKor}
			aria-label={`Switch language to ${next}`}
			color="default"
			size="medium"
			sx={{
				'& .MuiSwitch-thumb': {
					boxShadow: `0 0 3px ${alpha(silver.main, 0.72)}, 0 0 7px ${alpha(silver.light, 0.42)}`,
					transition: 'box-shadow 0.3s ease-in-out',
					'&:before': {
						content: lang === 'kor' ? '"한"' : '"EN"',
						position: 'absolute',
						width: '100%',
						height: '100%',
						left: 0,
						top: 0,
						backgroundRepeat: 'no-repeat',
						backgroundPosition: 'center',
						fontSize: '9px',
						fontWeight: 'bold',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: 'black',
					},
				},
			}}
		/>
	);
};
