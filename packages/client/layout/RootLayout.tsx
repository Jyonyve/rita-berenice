import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  Box,
  Container,
  Typography,
  CssBaseline,
  IconButton,
  Modal,
  Dialog,
  DialogContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { GlassPaper, GlassFooter, GlassPortrait } from './component/glass/index.js';
import { PageQueryState } from './component/PageQueryState.js';
import { routeConstants } from '../routeConstants.js';
import { getLangAlertText, getLangText } from '../util/translateUtils.js';
import { useAuth } from '../provider/AuthProvider.jsx';
import { useToast } from '../provider/ToastProvider.jsx';
import CloseIcon from '@mui/icons-material/Close';
import { useSessionApi } from '../hook/api/index.js';
import ReloadToHome from './component/ReloadToHome.js';
import { APPNAME, LANG_KEYS } from '@rita-berenice/shared/config';
import { SiteHeader } from './SiteHeader.js';
import { SessionHeader, type SessionHeaderInfo } from './SessionHeader.js';
import { LoreManagerDialog } from '../page/lore/LoreManagerDialog.js';

interface LoginModalProps {
  loginOpen: boolean;
  handleCloseLogin: () => void;
}

const LoginModal: FC<LoginModalProps> = ({ loginOpen, handleCloseLogin }) => (
  <Modal open={loginOpen} onClose={handleCloseLogin} disableScrollLock={true} aria-labelledby="login-modal-title">
    <GlassPaper
      onClick={handleCloseLogin}
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 0,
      }}
    >
      <Box onClick={(e) => e.stopPropagation()}>
        <AuthPage preBuiltUIList={[EmailPasswordPreBuiltUI]} />
      </Box>
    </GlassPaper>
  </Modal>
);

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string;
  characterId?: string;
}

const ImageModal: FC<ImageModalProps> = ({ open, onClose, imageUrl, characterId }) => {
  const theme = useTheme();

  if (!imageUrl) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent background
            boxShadow: 'none',
            maxWidth: 'unset',
            maxHeight: '90vh',
            overflow: 'visible',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 0,
          },
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          m: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
        onClick={onClose} // Close when clicking the background
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: '100%',
            maxHeight: '100%',
            overflow: 'visible',
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
        >
          <GlassPortrait
            imageUrl={imageUrl}
            alt={`${characterId} portrait`}
            hover={false}
            sx={{
              width: '100%',
              height: 'auto',
              borderRadius: theme.spacing(2),
              maxHeight: '80vh',
              objectFit: 'contain',
            }}
          />
          <IconButton
            onClick={onClose}
            aria-label="Close character image"
            sx={{
              position: 'absolute',
              top: theme.spacing(0.5),
              right: theme.spacing(0.5),
              color: 'white',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export type HeaderInfo = SessionHeaderInfo;
export type HeaderContextType = {
  setHeaderInfo: (info?: HeaderInfo) => void;
  setSessionHeaderHidden: (hidden: boolean) => void;
  headerInfo?: HeaderInfo;
};

type RootLayoutProps = { headerMode: 'site' | 'session' };

type VisualViewportBounds = { height: string; left: string; top: string; width: string };

const emptySessionHeaderInfo: SessionHeaderInfo = { characterId: '', profileShowName: '' };

export function RootLayout({ headerMode }: RootLayoutProps) {
  const isSmallScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [visualViewportBounds, setVisualViewportBounds] = useState<VisualViewportBounds>();
  const navigate = useNavigate();
  const {
    isSessionLoading,
    isLoggedIn,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    logout,
    userId,
    userProfile,
    profileLoadError,
    isProfileRefreshing,
    refetchProfile,
  } = useAuth();
  const { updateSessionTitle } = useSessionApi();
  const { addToast } = useToast();

  // The auth UI is mounted inside the login modal, so a successful sign-up or sign-in has
  // no page transition of its own to signal success. Confirm it explicitly the moment the
  // session settles; the modal unmounts on that same state change.
  const previousIsLoggedIn = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (isSessionLoading) return;

    const previous = previousIsLoggedIn.current;
    previousIsLoggedIn.current = isLoggedIn;
    if (previous === false && isLoggedIn) {
      addToast(getLangAlertText(LANG_KEYS.SIGNED_IN_SUCCESS), 'success');
    }
  }, [isSessionLoading, isLoggedIn, addToast]);

  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  const [headerInfo, setHeaderInfo] = useState<HeaderInfo>();
  const [sessionHeaderHidden, setSessionHeaderHidden] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [sessionLoreOpen, setSessionLoreOpen] = useState(false);
  const activeHeaderInfo = headerMode === 'session' ? (headerInfo ?? emptySessionHeaderInfo) : undefined;

  // State for controlling the dropdown menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);

  useLayoutEffect(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty('--header-height', `${headerRef.current.offsetHeight}px`);
    }
    if (footerRef.current) {
      document.documentElement.style.setProperty('--footer-height', `${footerRef.current.offsetHeight}px`);
    }
  }, []);

  useLayoutEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    let animationFrame: number | undefined;

    const syncVisualViewportBounds = () => {
      if (visualViewport.scale === 1) {
        const nextBounds = {
          height: `${Math.round(visualViewport.height)}px`,
          left: `${Math.round(visualViewport.offsetLeft)}px`,
          top: `${Math.round(visualViewport.offsetTop)}px`,
          width: `${Math.round(visualViewport.width)}px`,
        };
        document.documentElement.style.setProperty('--visual-viewport-height', nextBounds.height);
        document.documentElement.style.setProperty('--visual-viewport-offset-top', nextBounds.top);

        setVisualViewportBounds((currentBounds) =>
          currentBounds &&
          currentBounds.height === nextBounds.height &&
          currentBounds.left === nextBounds.left &&
          currentBounds.top === nextBounds.top &&
          currentBounds.width === nextBounds.width
            ? currentBounds
            : nextBounds,
        );
      }
    };

    const updateVisualViewportBounds = () => {
      syncVisualViewportBounds();
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(syncVisualViewportBounds);
    };

    updateVisualViewportBounds();
    visualViewport.addEventListener('resize', updateVisualViewportBounds);
    visualViewport.addEventListener('scroll', updateVisualViewportBounds);

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      visualViewport.removeEventListener('resize', updateVisualViewportBounds);
      visualViewport.removeEventListener('scroll', updateVisualViewportBounds);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--visual-viewport-offset-top');
    };
  }, []);

  const handleSessionTitleSave = async (sessionTitle: string) => {
    const sessionId = headerInfo?.sessionId;
    if (!sessionId) return;

    await updateSessionTitle({ sessionId, title: sessionTitle });
    setHeaderInfo((current) => (current?.sessionId === sessionId ? { ...current, sessionTitle } : current));
  };

  const handleSetHeaderInfo = useCallback((info?: HeaderInfo) => {
    setHeaderInfo(info);
  }, []);

  const outletContextValue = useMemo(
    () => ({ setHeaderInfo: handleSetHeaderInfo, setSessionHeaderHidden, headerInfo }),
    [headerInfo, handleSetHeaderInfo],
  );

  const handleProfileModalOpen = () => {
    headerInfo && setHeaderInfo({ ...headerInfo, editModalOpen: true });
  };

  const goUserPage = () => {
    navigate(`/${routeConstants.USER}`);
    handleMenuClose(); // Close menu after navigation
  };

  const goMyCharacterListPage = () => {
    navigate(`/${routeConstants.CHARACTER}`, { state: { isMine: true } });
    handleMenuClose(); // Close menu after navigation
  };

  const goCharacterPage = (characterId: string) => {
    navigate(`/${routeConstants.CHARACTER}/${characterId}`);
    handleMenuClose();
  };
  // In RootLayout component
  const onLogout = async () => {
    try {
      await logout();
      const currentPath = location.pathname;
      const sessionAuthPaths = ['/character/new', '/chat', '/history/'];

      const needsRedirect = sessionAuthPaths.some((path) => {
        if (path.endsWith('/')) return currentPath.startsWith(path);

        return currentPath === path || currentPath.startsWith(path + '/');
      });

      if (needsRedirect) {
        navigate('/');
      }

      handleMenuClose();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleImageModalOpen = () => {
    setImageModalOpen(true);
  };

  const handleImageModalClose = () => {
    setImageModalOpen(false);
  };

  return (
    <Box
      sx={{
        position: visualViewportBounds ? 'fixed' : 'relative',
        top: visualViewportBounds?.top ?? 0,
        left: visualViewportBounds?.left ?? 0,
        display: 'flex',
        flexDirection: 'column',
        width: visualViewportBounds?.width ?? '100%',
        height: visualViewportBounds?.height ?? '100vh',
        maxHeight: visualViewportBounds?.height ?? '100vh',
        overflow: 'hidden',
        ...(visualViewportBounds ? {} : { '@supports (height: 100dvh)': { height: '100dvh', maxHeight: '100dvh' } }),
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      <CssBaseline />
      {!activeHeaderInfo ? (
        <SiteHeader
          headerRef={headerRef}
          isLoggedIn={isLoggedIn}
          isSessionLoading={isSessionLoading}
          isMenuOpen={isMenuOpen}
          menuAnchor={anchorEl}
          userAvatarUrl={userProfile?.avatarUrl}
          onHome={() => navigate('/')}
          onCharacters={() => navigate(`/${routeConstants.CHARACTER}`)}
          onAccountMenuOpen={handleMenuOpen}
          onAccountMenuClose={handleMenuClose}
          onLogin={openLoginModal}
          onUser={goUserPage}
          onMyCharacters={goMyCharacterListPage}
          onLogout={onLogout}
        />
      ) : (
        <SessionHeader
          info={activeHeaderInfo}
          hidden={isSmallScreen && sessionHeaderHidden}
          isLoggedIn={isLoggedIn}
          isSessionLoading={isSessionLoading}
          isMenuOpen={isMenuOpen}
          menuAnchor={anchorEl}
          userAvatarUrl={userProfile?.avatarUrl}
          onCharacter={() => activeHeaderInfo.characterId && goCharacterPage(activeHeaderInfo.characterId)}
          onProfile={handleProfileModalOpen}
          onSession={() =>
            activeHeaderInfo.sessionId && navigate(`/${routeConstants.CHAT}/${activeHeaderInfo.sessionId}`)
          }
          onSessionTitleSave={handleSessionTitleSave}
          onSessionLore={() => setSessionLoreOpen(true)}
          onDocuments={() =>
            activeHeaderInfo.sessionId && navigate(`/${routeConstants.DOCUMENT}/${activeHeaderInfo.sessionId}`)
          }
          onImage={handleImageModalOpen}
          onAccountMenuOpen={handleMenuOpen}
          onAccountMenuClose={handleMenuClose}
          onLogin={openLoginModal}
          onUser={goUserPage}
          onMyCharacters={goMyCharacterListPage}
          onLogout={onLogout}
        />
      )}
      {/* Reload detector */}
      <ReloadToHome />

      {/* main box */}
      <Box component="main" sx={{ flex: 1, minHeight: 0, overflowY: headerMode === 'session' ? 'hidden' : 'auto' }}>
        {profileLoadError && isLoggedIn ? (
          <PageQueryState
            mode="error"
            message={getLangText(LANG_KEYS.FAILED_LOAD_DATA)}
            onRetry={refetchProfile}
            isRetrying={isProfileRefreshing}
          />
        ) : (
          <Outlet context={outletContextValue} />
        )}
      </Box>

      {/* Login Modal */}
      {!isLoggedIn && <LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />}
      {/* Image Modal */}
      <ImageModal
        open={imageModalOpen}
        onClose={handleImageModalClose}
        imageUrl={activeHeaderInfo?.mobileImageUrl}
        characterId={activeHeaderInfo?.characterId}
      />
      {userId && activeHeaderInfo?.characterId && activeHeaderInfo.sessionId ? (
        <LoreManagerDialog
          open={sessionLoreOpen}
          onClose={() => setSessionLoreOpen(false)}
          userId={userId}
          characterId={activeHeaderInfo.characterId}
          sessionId={activeHeaderInfo.sessionId}
        />
      ) : null}

      {/* Footer */}
      {/* Hidden through CSS breakpoints rather than `!isSmallScreen`: `useMediaQuery` always
			    reports false during SSR, so a JS branch here renders the footer on the server and drops
			    it on any client narrower than `md`, which fails hydration (React error #418). */}
      <GlassFooter
        ref={footerRef}
        sx={{
          display: { xs: 'none', md: 'block' },
          width: '100%',
          position: 'sticky',
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body2" color="text.secondary" align="center">
            {`Copyright © ${APPNAME} `}
            {'2025-2026'}
            {'.'}
          </Typography>
        </Container>
      </GlassFooter>
    </Box>
  );
}
