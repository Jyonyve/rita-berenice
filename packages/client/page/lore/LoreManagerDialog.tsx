import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { LANG_KEYS, METADATA_TYPES } from '@rita-berenice/shared/config';
import {
  LoreCategory,
  LoreInfo,
  SESSION_LORE_CONTENT_MAX_LENGTH,
  SESSION_LORE_TITLE_MAX_LENGTH,
} from '@rita-berenice/shared/domain';
import { createBasicLore } from '@rita-berenice/shared/util';
import { useLoreApi, useRecapApi } from '../../hook/api/index.js';
import { GlassButton, GlassCard } from '../../layout/component/glass/index.js';
import { mobileVisualViewportDialogSx } from '../../style/mobileDialogStyles.js';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';
import { getLangText } from '../../util/translateUtils.js';
import { sortSessionSummaries, syncEditingLoreRetrievalPreference } from './loreScope.js';

const CATEGORIES: Exclude<LoreCategory, 'World'>[] = [
  'Character',
  'Location',
  'Organization',
  'Culture',
  'Politics',
  'Magic',
  'Technology',
  'Item',
  'Event',
  'History',
  'Mythology',
  'Concept',
  'Other',
];

type LoreDraft = { title: string; content: string; category: LoreCategory };
type SessionDialogTab = 'memory' | 'summary';
const emptyDraft: LoreDraft = { title: '', content: '', category: 'Other' };

export const LoreManagerDialog: FC<{
  open: boolean;
  onClose: () => void;
  userId: string;
  characterId: string;
  sessionId?: string;
}> = ({ open, onClose, userId, characterId, sessionId }) => {
  const { storeLore, setRetrievalPreference, getEditableLoresByCharacter, getLoresBySession } = useLoreApi();
  const { getRecapsBySessionId } = useRecapApi();
  const characterQuery = getEditableLoresByCharacter(sessionId ? '' : characterId);
  const sessionQuery = getLoresBySession(sessionId ?? '');
  const factualSummaryQuery = getRecapsBySessionId(sessionId ?? '', METADATA_TYPES.RECAP);
  const relationshipSummaryQuery = getRecapsBySessionId(sessionId ?? '', METADATA_TYPES.RELATIONSHIP);
  const query = sessionId ? sessionQuery : characterQuery;
  const lores = useMemo(() => query.data?.loreInfos ?? [], [query.data?.loreInfos]);
  const summaries = useMemo(
    () => sortSessionSummaries([...(factualSummaryQuery.data ?? []), ...(relationshipSummaryQuery.data ?? [])]),
    [factualSummaryQuery.data, relationshipSummaryQuery.data],
  );
  const summaryIsPending = factualSummaryQuery.isPending || relationshipSummaryQuery.isPending;
  const summaryError = factualSummaryQuery.error ?? relationshipSummaryQuery.error;
  const [activeTab, setActiveTab] = useState<SessionDialogTab>('memory');
  const [editingLore, setEditingLore] = useState<LoreInfo>();
  const [draft, setDraft] = useState<LoreDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [retrievalUpdatingLoreId, setRetrievalUpdatingLoreId] = useState<string>();

  const resetEditor = useCallback(() => {
    setActiveTab('memory');
    setEditingLore(undefined);
    setDraft(emptyDraft);
    setSaveError(undefined);
  }, []);

  useEffect(() => {
    resetEditor();
  }, [characterId, sessionId, resetEditor]);

  useEffect(() => {
    if (!open) resetEditor();
  }, [open, resetEditor]);

  const handleClose = () => {
    if (isSaving) return;
    resetEditor();
    onClose();
  };
  const startEdit = (lore: LoreInfo) => {
    setEditingLore(lore);
    setDraft({
      title: lore.title,
      content: lore.content,
      category: lore.category,
    });
    setSaveError(undefined);
  };
  const handleSave = async () => {
    if (!draft.title.trim() || !draft.content.trim()) return;
    if (
      sessionId &&
      (draft.title.trim().length > SESSION_LORE_TITLE_MAX_LENGTH ||
        draft.content.trim().length > SESSION_LORE_CONTENT_MAX_LENGTH)
    ) {
      return;
    }
    setIsSaving(true);
    setSaveError(undefined);
    try {
      const now = new Date().toISOString();
      const lore = editingLore
        ? {
            ...editingLore,
            ...draft,
            title: draft.title.trim(),
            content: draft.content.trim(),
            updatedAt: now,
          }
        : {
            ...createBasicLore({
              userId,
              characterIds: [characterId],
              sessionId,
              title: draft.title.trim(),
              content: draft.content.trim(),
            }),
            category: draft.category,
          };
      await storeLore(lore as LoreInfo);
      resetEditor();
    } catch (error) {
      setSaveError(
        getClientErrorMessage(
          error,
          getLangText(sessionId ? LANG_KEYS.MEMORY_SAVE_FAILED : LANG_KEYS.LORE_SAVE_FAILED),
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetrievalPreference = async (lore: LoreInfo, enabled: boolean) => {
    setRetrievalUpdatingLoreId(lore.loreId);
    setSaveError(undefined);
    try {
      const response = await setRetrievalPreference({ loreId: lore.loreId, enabled, characterId, sessionId });
      setEditingLore((current) => syncEditingLoreRetrievalPreference(current, response.loreInfo));
    } catch (error) {
      setSaveError(getClientErrorMessage(error, getLangText(LANG_KEYS.MEMORY_RETRIEVAL_UPDATE_FAILED)));
    } finally {
      setRetrievalUpdatingLoreId(undefined);
    }
  };

  const scopeTitle = getLangText(sessionId ? LANG_KEYS.SESSION_LORE : LANG_KEYS.CHARACTER_LORE);
  const scopeDescription = getLangText(
    sessionId ? LANG_KEYS.SESSION_LORE_DESCRIPTION : LANG_KEYS.CHARACTER_LORE_DESCRIPTION,
  );

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : handleClose}
      fullWidth
      maxWidth="md"
      sx={mobileVisualViewportDialogSx}
    >
      <DialogTitle>{scopeTitle}</DialogTitle>
      <DialogContent>
        {sessionId ? (
          <Tabs
            value={activeTab}
            onChange={(_, value: SessionDialogTab) => setActiveTab(value)}
            aria-label={getLangText(LANG_KEYS.SESSION_LORE)}
            sx={{ mb: 2 }}
          >
            <Tab value="memory" label={getLangText(LANG_KEYS.SESSION_LORE)} />
            <Tab value="summary" label={getLangText(LANG_KEYS.SESSION_SUMMARY)} />
          </Tabs>
        ) : null}

        {activeTab === 'memory' ? (
          <>
            {sessionId && activeTab === 'memory' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {scopeDescription}
              </Alert>
            )}
            {query.isPending ? (
              <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress
                  size={28}
                  aria-label={getLangText(sessionId ? LANG_KEYS.LOADING_MEMORY : LANG_KEYS.LOADING_LORE)}
                />
              </Box>
            ) : query.isError ? (
              <Alert
                severity="error"
                action={<GlassButton onClick={() => query.refetch()}>{getLangText(LANG_KEYS.RETRY)}</GlassButton>}
              >
                {getClientErrorMessage(
                  query.error,
                  getLangText(sessionId ? LANG_KEYS.MEMORY_LOAD_FAILED : LANG_KEYS.LORE_LOAD_FAILED),
                )}
              </Alert>
            ) : (
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                {lores.length === 0 ? (
                  <Typography color="text.secondary">
                    {getLangText(sessionId ? LANG_KEYS.NO_MEMORY : LANG_KEYS.NO_LORE)}
                  </Typography>
                ) : (
                  lores.map((lore) => (
                    <GlassCard key={lore.loreId} variant="outlined">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: { xs: 'stretch', sm: 'flex-start' },
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700}>{lore.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {lore.category}
                          </Typography>
                          <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{lore.content}</Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'space-between', sm: 'flex-end' },
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            component="label"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
                          >
                            <Switch
                              size="small"
                              checked={lore.retrievalEnabled === true}
                              onChange={(_, checked) => void handleRetrievalPreference(lore, checked)}
                              disabled={Boolean(retrievalUpdatingLoreId) || isSaving}
                              slotProps={{
                                input: {
                                  'aria-label': `${lore.title} ${getLangText(LANG_KEYS.USE_IN_CONVERSATION_RAG)}`,
                                },
                              }}
                            />
                            <Typography variant="caption">{getLangText(LANG_KEYS.USE_IN_CONVERSATION_RAG)}</Typography>
                          </Box>
                          <IconButton
                            aria-label={`${getLangText(LANG_KEYS.EDIT)} ${lore.title}`}
                            onClick={() => startEdit(lore)}
                            disabled={retrievalUpdatingLoreId === lore.loreId}
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </GlassCard>
                  ))
                )}
              </Stack>
            )}

            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSave();
              }}
            >
              <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
                {getLangText(
                  sessionId
                    ? editingLore
                      ? LANG_KEYS.EDIT_MEMORY
                      : LANG_KEYS.ADD_MEMORY
                    : editingLore
                      ? LANG_KEYS.EDIT_LORE
                      : LANG_KEYS.ADD_LORE,
                )}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={getLangText(LANG_KEYS.TITLE)}
                  required
                  value={draft.title}
                  disabled={isSaving}
                  onChange={(e) => setDraft((value) => ({ ...value, title: e.target.value }))}
                  inputProps={sessionId ? { maxLength: SESSION_LORE_TITLE_MAX_LENGTH } : undefined}
                  helperText={sessionId ? `${draft.title.length}/${SESSION_LORE_TITLE_MAX_LENGTH}` : undefined}
                />
                <TextField
                  select
                  label={getLangText(LANG_KEYS.LORE_CATEGORY)}
                  value={draft.category}
                  disabled={isSaving}
                  onChange={(e) => setDraft((value) => ({ ...value, category: e.target.value as LoreCategory }))}
                >
                  {editingLore?.category === 'World' ? <MenuItem value="World">World</MenuItem> : null}
                  {CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={getLangText(sessionId ? LANG_KEYS.MEMORY_CONTENT : LANG_KEYS.LORE_CONTENT)}
                  required
                  multiline
                  minRows={5}
                  maxRows={14}
                  value={draft.content}
                  disabled={isSaving}
                  onChange={(e) => setDraft((value) => ({ ...value, content: e.target.value }))}
                  placeholder={sessionId ? getLangText(LANG_KEYS.MEMORY_CONTENT_PLACEHOLDER) : undefined}
                  inputProps={sessionId ? { maxLength: SESSION_LORE_CONTENT_MAX_LENGTH } : undefined}
                  helperText={sessionId ? `${draft.content.length}/${SESSION_LORE_CONTENT_MAX_LENGTH}` : undefined}
                />
                {saveError ? <Alert severity="error">{saveError}</Alert> : null}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  {editingLore ? (
                    <GlassButton onClick={resetEditor} disabled={isSaving}>
                      {getLangText(LANG_KEYS.CANCEL)}
                    </GlassButton>
                  ) : null}
                  <GlassButton
                    type="submit"
                    colorVariant="secondary"
                    disabled={
                      isSaving ||
                      !draft.title.trim() ||
                      !draft.content.trim() ||
                      Boolean(
                        sessionId &&
                          (draft.title.trim().length > SESSION_LORE_TITLE_MAX_LENGTH ||
                            draft.content.trim().length > SESSION_LORE_CONTENT_MAX_LENGTH),
                      )
                    }
                    aria-busy={isSaving}
                    startIcon={editingLore ? <EditOutlinedIcon /> : <AddIcon />}
                  >
                    {getLangText(isSaving ? LANG_KEYS.SAVING : LANG_KEYS.SAVE)}
                  </GlassButton>
                </Box>
              </Stack>
            </Box>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              {getLangText(LANG_KEYS.SESSION_SUMMARY_DESCRIPTION)}
            </Alert>
            {summaryIsPending ? (
              <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} aria-label={getLangText(LANG_KEYS.LOADING_SESSION_SUMMARY)} />
              </Box>
            ) : summaryError ? (
              <Alert
                severity="error"
                action={
                  <GlassButton
                    onClick={() =>
                      void Promise.all([factualSummaryQuery.refetch(), relationshipSummaryQuery.refetch()])
                    }
                  >
                    {getLangText(LANG_KEYS.RETRY)}
                  </GlassButton>
                }
              >
                {getClientErrorMessage(summaryError, getLangText(LANG_KEYS.SESSION_SUMMARY_LOAD_FAILED))}
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {summaries.length === 0 ? (
                  <Typography color="text.secondary">{getLangText(LANG_KEYS.NO_SESSION_SUMMARY)}</Typography>
                ) : (
                  summaries.map((summaryItem) => (
                    <GlassCard key={summaryItem.recapId} variant="outlined">
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ mb: 1, alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Chip
                          size="small"
                          label={getLangText(
                            summaryItem.type === METADATA_TYPES.RELATIONSHIP
                              ? LANG_KEYS.RELATIONSHIP_SUMMARY
                              : LANG_KEYS.FACTUAL_SUMMARY,
                          )}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {getLangText(LANG_KEYS.TURN_RANGE)} {summaryItem.turnStart}–{summaryItem.turnEnd}
                        </Typography>
                      </Stack>
                      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{summaryItem.content}</Typography>
                    </GlassCard>
                  ))
                )}
              </Stack>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <GlassButton onClick={handleClose} disabled={isSaving}>
          {getLangText(LANG_KEYS.CANCEL)}
        </GlassButton>
      </DialogActions>
    </Dialog>
  );
};
