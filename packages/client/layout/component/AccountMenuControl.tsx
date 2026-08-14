import type { MouseEvent } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../../util/translateUtils.js';
import { GlassMenu, GlassMenuItem } from './glass/index.js';
import { HeaderIconButton } from './HeaderIconButton.js';
import { LanguageSwitch } from './LanguageSwitch.js';
import { ThemeSwitch } from './ThemeSwitch.js';

export type AccountMenuControlProps = {
	isLoggedIn: boolean;
	isSessionLoading: boolean;
	isMenuOpen: boolean;
	menuAnchor: HTMLElement | null;
	userAvatarUrl?: string;
	onAccountMenuOpen: (event: MouseEvent<HTMLElement>) => void;
	onAccountMenuClose: () => void;
	onLogin: () => void;
	onUser: () => void;
	onMyCharacters: () => void;
	onLogout: () => void;
};

export function AccountMenuControl({
	isLoggedIn,
	isSessionLoading,
	isMenuOpen,
	menuAnchor,
	userAvatarUrl,
	onAccountMenuOpen,
	onAccountMenuClose,
	onLogin,
	onUser,
	onMyCharacters,
	onLogout,
}: AccountMenuControlProps) {
	if (isSessionLoading) return null;

	return (
		<>
			<HeaderIconButton
				onClick={isLoggedIn ? onAccountMenuOpen : onLogin}
				aria-label={isLoggedIn ? 'account of current user' : 'login'}
				aria-controls={isMenuOpen ? 'account-menu' : undefined}
				aria-haspopup="true"
				sx={!isLoggedIn ? { color: 'text.disabled' } : undefined}
			>
				<AccountCircleIcon />
			</HeaderIconButton>
			<GlassMenu
				id="account-menu"
				anchorEl={menuAnchor}
				open={isMenuOpen}
				onClose={onAccountMenuClose}
			>
				<GlassMenuItem onClick={onUser} colorVariant="silver" sx={{ alignItems: 'center', my: 1 }}>
					<Avatar src={userAvatarUrl} variant="circular" sx={{ mr: 2 }} />
					<Typography variant="subtitle1">{getLangText(LANG_KEYS.USER_INFO)}</Typography>
				</GlassMenuItem>
				<GlassMenuItem onClick={onMyCharacters} colorVariant="silver">
					{getLangText(LANG_KEYS.MY_CHARACTERS)}
				</GlassMenuItem>
				<GlassMenuItem onClick={onLogout} colorVariant="silver">
					{getLangText(LANG_KEYS.LOGOUT)}
				</GlassMenuItem>
				<Box
					sx={{ display: 'flex', width: '100%', justifyContent: 'space-around', mb: 1, mt: 2 }}
					onClick={(event) => event.stopPropagation()}
				>
					<ThemeSwitch />
					<LanguageSwitch />
				</Box>
			</GlassMenu>
		</>
	);
}
