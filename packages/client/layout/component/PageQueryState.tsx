import { Button, Container, Stack, Typography } from '@mui/material';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../../util/translateUtils.js';
import { GlassCircularProgress } from './glass/index.js';

interface PageQueryStateProps {
  mode: 'loading' | 'error';
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function PageQueryState({ mode, message, onRetry, isRetrying = false }: PageQueryStateProps) {
  const isLoading = mode === 'loading';

  return (
    <Container
      role={isLoading ? 'status' : 'alert'}
      aria-live={isLoading ? 'polite' : 'assertive'}
      aria-busy={isLoading || isRetrying}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
      }}
    >
      <Stack spacing={2} alignItems="center">
        {isLoading ? <GlassCircularProgress colorVariant="silver" /> : null}
        <Typography color={isLoading ? 'text.primary' : 'error'} textAlign="center">
          {message}
        </Typography>
        {!isLoading && onRetry ? (
          <Button onClick={onRetry} disabled={isRetrying} variant="outlined">
            {isRetrying ? <GlassCircularProgress size={20} colorVariant="silver" /> : getLangText(LANG_KEYS.RETRY)}
          </Button>
        ) : null}
      </Stack>
    </Container>
  );
}
