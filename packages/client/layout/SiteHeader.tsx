import type { MouseEvent, RefObject } from 'react';
import { Box, Toolbar } from '@mui/material';
import { APPNAME, LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../util/translateUtils.js';
import { GlassAppBar } from './component/glass/index.js';
import { LanguageSwitch } from './component/index.js';
import { AccountMenuControl } from './component/AccountMenuControl.js';
import { RomanticTitle } from './component/RomanticTitle.js';

type SiteHeaderProps = {
  headerRef: RefObject<HTMLElement | null>;
  isLoggedIn: boolean;
  isSessionLoading: boolean;
  isMenuOpen: boolean;
  menuAnchor: HTMLElement | null;
  userAvatarUrl?: string;
  onHome: () => void;
  onCharacters: () => void;
  onAccountMenuOpen: (event: MouseEvent<HTMLElement>) => void;
  onAccountMenuClose: () => void;
  onLogin: () => void;
  onUser: () => void;
  onMyCharacters: () => void;
  onLogout: () => void;
};

export function SiteHeader({
  headerRef,
  isLoggedIn,
  isSessionLoading,
  isMenuOpen,
  menuAnchor,
  userAvatarUrl,
  onHome,
  onCharacters,
  onAccountMenuOpen,
  onAccountMenuClose,
  onLogin,
  onUser,
  onMyCharacters,
  onLogout,
}: SiteHeaderProps) {
  return (
    <GlassAppBar color="inherit" sx={{ width: '100%', position: 'static' }} ref={headerRef}>
      <Toolbar sx={{ minHeight: { xs: 48, sm: 56 }, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <RomanticTitle
            logo
            variant="h6"
            component="div"
            onClick={onHome}
            role="button"
            sx={{ pr: { xs: 1, sm: 2 }, whiteSpace: 'nowrap' }}
          >
            {APPNAME}
          </RomanticTitle>
          <RomanticTitle
            variant="subtitle1"
            component="div"
            onClick={onCharacters}
            role="button"
            sx={{ px: 1, whiteSpace: 'nowrap' }}
          >
            {getLangText(LANG_KEYS.CHARACTERS)}
          </RomanticTitle>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {!isLoggedIn && <LanguageSwitch />}
          <AccountMenuControl
            isLoggedIn={isLoggedIn}
            isSessionLoading={isSessionLoading}
            isMenuOpen={isMenuOpen}
            menuAnchor={menuAnchor}
            userAvatarUrl={userAvatarUrl}
            onAccountMenuOpen={onAccountMenuOpen}
            onAccountMenuClose={onAccountMenuClose}
            onLogin={onLogin}
            onUser={onUser}
            onMyCharacters={onMyCharacters}
            onLogout={onLogout}
          />
        </Box>
      </Toolbar>
    </GlassAppBar>
  );
}
