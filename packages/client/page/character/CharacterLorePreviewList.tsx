import {
  Alert,
  Box,
  Chip,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { FC, Fragment, useState } from 'react';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useLoreApi } from '../../hook/api/index.js';
import { GlassButton, GlassCircularProgress } from '../../layout/component/glass/index.js';
import { SafeRichText } from '../../layout/component/SafeRichText.js';
import { silver } from '../../style/colors.js';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';
import { formatTimestamp } from '../../util/styleUtils.jsx';
import { getLangText } from '../../util/translateUtils.js';

export const CharacterLorePreviewList: FC<{ characterId: string }> = ({ characterId }) => {
  const query = useLoreApi().getActiveLoresByCharacter(characterId);
  const lores = query.data?.loreInfos ?? [];
  const [expandedLoreId, setExpandedLoreId] = useState<string>();

  if (query.isPending) {
    return (
      <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <GlassCircularProgress colorVariant="silver" size={28} aria-label={getLangText(LANG_KEYS.LOADING_LORE)} />
      </Box>
    );
  }

  if (query.isError) {
    return (
      <Alert
        severity="error"
        action={<GlassButton onClick={() => query.refetch()}>{getLangText(LANG_KEYS.RETRY)}</GlassButton>}
      >
        {getClientErrorMessage(query.error, getLangText(LANG_KEYS.LORE_LOAD_FAILED))}
      </Alert>
    );
  }

  return (
    <>
      <List dense>
        {lores.length === 0 ? (
          <ListItem>
            <ListItemText
              primary={
                <Typography variant="body2" color="text.secondary">
                  {getLangText(LANG_KEYS.NO_LORE)}
                </Typography>
              }
            />
          </ListItem>
        ) : (
          lores.map((lore, index) => (
            <Fragment key={lore.loreId}>
              <ListItem disablePadding>
                <ListItemButton
                  disableRipple
                  onClick={() => setExpandedLoreId((current) => (current === lore.loreId ? undefined : lore.loreId))}
                  aria-expanded={expandedLoreId === lore.loreId}
                  aria-controls={expandedLoreId === lore.loreId ? `character-lore-content-${lore.loreId}` : undefined}
                  aria-label={`${lore.title} ${getLangText(LANG_KEYS.CHARACTER_LORE)}`}
                  sx={{
                    borderRadius: 1,
                    ...(expandedLoreId === lore.loreId && { '&:hover': { bgcolor: 'transparent' } }),
                  }}
                >
                  <ListItemText
                    disableTypography
                    primary={
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 2,
                            width: '100%',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {lore.title}
                            </Typography>
                            {lore.category === 'World' ? (
                              <Chip
                                label={lore.category}
                                size="small"
                                variant="outlined"
                                sx={{ color: silver.main, borderColor: silver.main, height: 20, flexShrink: 0 }}
                              />
                            ) : null}
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                          >
                            {formatTimestamp(lore.updatedAt)}
                          </Typography>
                        </Box>
                        {expandedLoreId !== lore.loreId ? (
                          <SafeRichText
                            text={lore.content}
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.5,
                              display: '-webkit-box',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                            }}
                          />
                        ) : null}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
              <Collapse
                id={`character-lore-content-${lore.loreId}`}
                role="region"
                aria-label={lore.title}
                in={expandedLoreId === lore.loreId}
                timeout="auto"
                unmountOnExit
              >
                <Box sx={{ px: 2, pb: 2, pt: 0.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <SafeRichText text={lore.content} />
                </Box>
              </Collapse>
              {index < lores.length - 1 && <Divider component="li" />}
            </Fragment>
          ))
        )}
      </List>
    </>
  );
};
