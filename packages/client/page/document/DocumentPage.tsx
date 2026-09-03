import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import {
  Box,
  Backdrop,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  type SxProps,
  type Theme,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import DifferenceOutlinedIcon from '@mui/icons-material/DifferenceOutlined';
import { DOCUMENT_CLAIM_MODES, type DocumentInfo } from '@rita-berenice/shared/domain';
import { DEFAULT_CHAT_MODEL, DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import { parseSessionId } from '@rita-berenice/shared/util';
import { useDocumentApi } from '../../hook/api/useDocumentApi.js';
import { useLlmApi } from '../../hook/api/useLlmApi.js';
import { useCharacterApi, useProfileApi, useSessionApi } from '../../hook/api/index.js';
import type { HeaderContextType } from '../../layout/RootLayout.js';
import { GlassButton, GlassCard, GlassPaper } from '../../layout/component/glass/index.js';
import { SafeRichText } from '../../layout/component/SafeRichText.js';
import { AiModelSelector } from '../chat/AiModelSelector.js';
import { getLangText } from '../../util/translateUtils.js';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';
import { getImageForEmotion } from '../../util/portraitUtils.js';
import { getConversationAvatar } from '../chat/conversationAvatarUtils.js';
import { DocumentDiff } from './DocumentDiff.js';
import { resolveLastDocumentRequest } from './documentDiffUtils.js';
import { filterDocumentsByRagPreference, type DocumentRagFilter } from './documentPageUtils.js';

type EditorState = Pick<
  DocumentInfo,
  | 'title'
  | 'body'
  | 'documentKind'
  | 'issuer'
  | 'viewpoint'
  | 'claimMode'
  | 'eventKey'
  | 'inWorldTime'
  | 'retrievalEnabled'
> & { timelineOrder: number | null };

type ComparisonState = { documentId: string; before: EditorState; instruction: string };

const toEditorState = (document: DocumentInfo): EditorState => ({
  title: document.title,
  body: document.body,
  documentKind: document.documentKind ?? '',
  issuer: document.issuer ?? '',
  viewpoint: document.viewpoint ?? '',
  claimMode: document.claimMode ?? 'unknown',
  eventKey: document.eventKey ?? '',
  timelineOrder: document.timelineOrder ?? null,
  inWorldTime: document.inWorldTime ?? '',
  retrievalEnabled: document.retrievalEnabled,
});

const isEditorDirty = (document: DocumentInfo, editor: EditorState): boolean => {
  const original = toEditorState(document);
  return (
    original.title !== editor.title ||
    original.body !== editor.body ||
    original.documentKind !== editor.documentKind ||
    original.issuer !== editor.issuer ||
    original.viewpoint !== editor.viewpoint ||
    original.claimMode !== editor.claimMode ||
    original.eventKey !== editor.eventKey ||
    original.timelineOrder !== editor.timelineOrder ||
    original.inWorldTime !== editor.inWorldTime ||
    original.retrievalEnabled !== editor.retrievalEnabled
  );
};

const editorToDiffText = (editor: EditorState): string =>
  [
    `${getLangText(LANG_KEYS.DOCUMENT_TITLE)}: ${editor.title}`,
    `${getLangText(LANG_KEYS.DOCUMENT_KIND)}: ${editor.documentKind}`,
    `${getLangText(LANG_KEYS.DOCUMENT_ISSUER)}: ${editor.issuer}`,
    `${getLangText(LANG_KEYS.DOCUMENT_VIEWPOINT)}: ${editor.viewpoint}`,
    `${getLangText(LANG_KEYS.DOCUMENT_CLAIM_MODE)}: ${getDocumentClaimModeText(editor.claimMode)}`,
    `${getLangText(LANG_KEYS.DOCUMENT_EVENT_KEY)}: ${editor.eventKey}`,
    `${getLangText(LANG_KEYS.DOCUMENT_TIMELINE_ORDER)}: ${editor.timelineOrder ?? ''}`,
    `${getLangText(LANG_KEYS.DOCUMENT_IN_WORLD_TIME)}: ${editor.inWorldTime}`,
    '',
    `${getLangText(LANG_KEYS.DOCUMENT_CONTENT)}:`,
    editor.body,
  ].join('\n');

const getDocumentStatusText = (status: DocumentInfo['status']) =>
  getLangText(
    {
      draft: LANG_KEYS.DOCUMENT_STATUS_DRAFT,
      approved: LANG_KEYS.DOCUMENT_STATUS_APPROVED,
      archived: LANG_KEYS.DOCUMENT_STATUS_ARCHIVED,
    }[status],
  );

const getDocumentClaimModeText = (claimMode: DocumentInfo['claimMode']) =>
  getLangText(
    {
      record: LANG_KEYS.DOCUMENT_CLAIM_RECORD,
      statement: LANG_KEYS.DOCUMENT_CLAIM_STATEMENT,
      report: LANG_KEYS.DOCUMENT_CLAIM_REPORT,
      rumor: LANG_KEYS.DOCUMENT_CLAIM_RUMOR,
      opinion: LANG_KEYS.DOCUMENT_CLAIM_OPINION,
      propaganda: LANG_KEYS.DOCUMENT_CLAIM_PROPAGANDA,
      unknown: LANG_KEYS.DOCUMENT_CLAIM_UNKNOWN,
    }[claimMode],
  );

export function DocumentPage() {
  const { sessionId = '' } = useParams();
  const { setHeaderInfo } = useOutletContext<HeaderContextType>();
  const api = useDocumentApi();
  const { getModelCatalog } = useLlmApi();
  const { data: modelCatalog } = getModelCatalog();
  const { data, isLoading, error } = api.getDocumentsBySession(sessionId);
  const characterId = useMemo(() => parseSessionId(sessionId)?.characterId ?? '', [sessionId]);
  const { data: characterRes } = useCharacterApi().getCharacter(characterId);
  const { data: profileRes } = useProfileApi().getProfileBySessionId(sessionId);
  const { data: sessionRes } = useSessionApi().getSession(sessionId);
  const documents = data?.documentInfos ?? [];
  const loadError = error && getClientErrorMessage(error, 'Could not load documents.');
  const interactionRootRef = useRef<HTMLDivElement>(null);
  const [ragFilter, setRagFilter] = useState<DocumentRagFilter>('all');
  const filteredDocuments = useMemo(() => filterDocumentsByRagPreference(documents, ragFilter), [documents, ragFilter]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = useMemo(
    () => documents.find((document) => document.documentId === selectedId) ?? documents[0],
    [documents, selectedId],
  );
  const [editor, setEditor] = useState<EditorState>();
  const [editorRevision, setEditorRevision] = useState<number>();
  const [comparison, setComparison] = useState<ComparisonState>();
  const [isComparisonVisible, setIsComparisonVisible] = useState(true);
  const [generationRequest, setGenerationRequest] = useState('');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [generationModelName, setGenerationModelName] = useState(DEFAULT_CHAT_MODEL);
  const [rewriteModelName, setRewriteModelName] = useState(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    if (!characterRes?.characterInfo || !profileRes?.profileInfo || !sessionRes?.sessionInfo) return;

    const character = characterRes.characterInfo;
    setHeaderInfo({
      characterId: character.characterId,
      profileShowName: profileRes.profileInfo.showName,
      sessionId,
      sessionTitle: sessionRes.sessionInfo.title,
      avatarUrl: getConversationAvatar(
        characterRes.characterAvatars[character.characterId],
        characterRes.characterPortraits[character.characterId],
        DEFAULT_EMOTION,
      ),
      mobileImageUrl: getImageForEmotion(characterRes.characterPortraits[character.characterId], DEFAULT_EMOTION) ?? '',
    });
  }, [characterRes, profileRes, sessionId, sessionRes, setHeaderInfo]);

  useEffect(() => {
    return () => setHeaderInfo(undefined);
  }, [setHeaderInfo]);

  useEffect(() => {
    if (!modelCatalog?.models.length) return;
    const fallbackModel = modelCatalog.models[0].id;
    if (!modelCatalog.models.some((model) => model.id === generationModelName)) {
      setGenerationModelName(fallbackModel);
    }
    if (!modelCatalog.models.some((model) => model.id === rewriteModelName)) {
      setRewriteModelName(fallbackModel);
    }
  }, [generationModelName, modelCatalog, rewriteModelName]);

  useEffect(() => {
    const interactionRoot = interactionRootRef.current;
    if (!interactionRoot) return;
    interactionRoot.inert = api.isGenerating;
    if (
      api.isGenerating &&
      document.activeElement instanceof HTMLElement &&
      interactionRoot.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
    return () => {
      interactionRoot.inert = false;
    };
  }, [api.isGenerating]);

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.documentId);
      setEditor(toEditorState(selected));
      setEditorRevision(selected.revision);
    } else {
      setSelectedId(undefined);
      setEditor(undefined);
      setEditorRevision(undefined);
    }
  }, [selected?.documentId, selected?.revision]);

  const createDraft = async () => {
    const result = await api.createManualDraft({
      sessionId,
      title: getLangText(LANG_KEYS.NEW_DOCUMENT),
      body: '',
      claimMode: 'unknown',
    });
    setSelectedId(result.documentInfo.documentId);
    setEditor(toEditorState(result.documentInfo));
    setEditorRevision(result.documentInfo.revision);
    setComparison(undefined);
    setIsComparisonVisible(true);
  };

  const generateDraft = async () => {
    if (!generationRequest.trim()) return;
    const result = await api.generateDraft({
      sessionId,
      requestText: generationRequest.trim(),
      modelName: generationModelName,
      retrievalEnabled: false,
    });
    setSelectedId(result.documentInfo.documentId);
    setEditor(toEditorState(result.documentInfo));
    setEditorRevision(result.documentInfo.revision);
    setComparison(undefined);
    setIsComparisonVisible(true);
    setGenerationRequest('');
  };

  const saveDraft = async () => {
    if (!selected || !editor || !editorRevision) return;
    const result = await api.updateDraft({
      documentId: selected.documentId,
      sessionId,
      input: { ...editor, expectedRevision: editorRevision },
    });
    setEditor(toEditorState(result.documentInfo));
    setEditorRevision(result.documentInfo.revision);
  };

  const rewriteDraft = async () => {
    if (!selected || !editor || !editorRevision || selected.status !== 'draft' || !rewriteInstruction.trim()) return;
    const baseDocument = isEditorDirty(selected, editor)
      ? (
          await api.updateDraft({
            documentId: selected.documentId,
            sessionId,
            input: { ...editor, expectedRevision: editorRevision },
          })
        ).documentInfo
      : selected;
    const instruction = rewriteInstruction.trim();
    const result = await api.rewriteDraft({
      documentId: baseDocument.documentId,
      sessionId,
      input: {
        editInstruction: instruction,
        modelName: rewriteModelName,
        expectedRevision: baseDocument.revision,
      },
    });
    setSelectedId(result.documentInfo.documentId);
    setEditor(toEditorState(result.documentInfo));
    setEditorRevision(result.documentInfo.revision);
    setComparison({
      documentId: result.documentInfo.documentId,
      before: toEditorState(baseDocument),
      instruction,
    });
    setIsComparisonVisible(true);
    setRewriteInstruction('');
  };

  const approveDraft = async () => {
    if (!selected || !window.confirm(getLangText(LANG_KEYS.CONFIRM_APPROVE_DOCUMENT))) {
      return;
    }
    await api.approve({ documentId: selected.documentId, sessionId });
  };

  const deleteDraft = async () => {
    if (!selected || !window.confirm(getLangText(LANG_KEYS.CONFIRM_DELETE_DOCUMENT))) return;
    await api.deleteDraft({ documentId: selected.documentId, sessionId });
    setSelectedId(undefined);
    setComparison(undefined);
    setIsComparisonVisible(true);
  };

  const lastRequestText = resolveLastDocumentRequest(selected?.documentId, selected?.requestText, comparison);
  const approvedFieldSx: SxProps<Theme> | undefined =
    selected?.status === 'approved'
      ? (theme) => ({
          '& .MuiInputBase-input.Mui-disabled': {
            color: theme.palette.text.primary,
            opacity: 1,
            WebkitTextFillColor: theme.palette.text.primary,
          },
        })
      : undefined;

  const setRetrievalPreference = async (enabled: boolean) => {
    if (!selected || !editor || selected.status === 'archived') return;

    const previousPreference = editor.retrievalEnabled;
    const updatedEditor = { ...editor, retrievalEnabled: enabled };
    setEditor(updatedEditor);

    try {
      if (selected.status === 'draft') {
        if (editorRevision === undefined) {
          setEditor(editor);
          return;
        }
        const result = await api.updateDraft({
          documentId: selected.documentId,
          sessionId,
          input: { ...updatedEditor, expectedRevision: editorRevision },
        });
        setEditor(toEditorState(result.documentInfo));
        setEditorRevision(result.documentInfo.revision);
        return;
      }
      if (selected.status === 'approved') {
        const result = await api.setRetrievalPreference({
          documentId: selected.documentId,
          sessionId,
          enabled,
        });
        setEditor(toEditorState(result.documentInfo));
        setEditorRevision(result.documentInfo.revision);
      }
    } catch {
      setEditor({ ...editor, retrievalEnabled: previousPreference });
    }
  };

  return (
    <>
      <Backdrop
        open={api.isGenerating}
        sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.modal + 1 }}
        role="status"
        aria-live="assertive"
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography>{getLangText(LANG_KEYS.AI_DOCUMENT_GENERATION_IN_PROGRESS)}</Typography>
        </Stack>
      </Backdrop>
      <Box
        ref={interactionRootRef}
        sx={{ width: '100%', height: '100%', overflowY: 'auto', p: { xs: 1, sm: 2, md: 3 } }}
      >
        {loadError && <Typography color="error">{loadError}</Typography>}
        <GlassCard sx={{ mb: 2, height: 'auto' }} contentProps={{ sx: { p: 2, '&:last-child': { pb: 2 } } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
            <TextField
              label={getLangText(LANG_KEYS.DOCUMENT_GENERATION_REQUEST)}
              value={generationRequest}
              onChange={(event) => setGenerationRequest(event.target.value)}
              multiline
              minRows={2}
              fullWidth
              disabled={api.isMutating}
              slotProps={{ htmlInput: { maxLength: 5000 } }}
            />
            <AiModelSelector
              modelName={generationModelName}
              onAiModel={setGenerationModelName}
              models={modelCatalog?.models}
              disabled={api.isMutating}
            />
            <GlassButton
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={generateDraft}
              disabled={api.isMutating || !generationRequest.trim()}
              sx={{ flexShrink: 0 }}
            >
              {getLangText(LANG_KEYS.GENERATE_DOCUMENT)}
            </GlassButton>
          </Stack>
        </GlassCard>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          <GlassCard
            sx={{ flex: { md: '0 0 30%' }, minWidth: 0, height: 'auto' }}
            contentProps={{ sx: { p: 0, '&:last-child': { pb: 0 } } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
              <Tabs
                value={ragFilter}
                onChange={(_, value: DocumentRagFilter) => setRagFilter(value)}
                variant="fullWidth"
                aria-label={getLangText(LANG_KEYS.USE_IN_CONVERSATION_RAG)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTab-root': {
                    minWidth: 0,
                    minHeight: 40,
                    // px: 1,
                    // py: 0.75,
                    position: 'relative',
                    borderRight: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: '1rem',
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    textTransform: 'none',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      left: 0,
                      height: 1,
                      backgroundColor: 'divider',
                      opacity: 1,
                      transition: 'none',
                    },
                  },
                  '& .MuiTab-root.Mui-selected': {
                    color: 'text.primary',
                    backgroundColor: 'background.paper',
                    '&::after': { opacity: 0 },
                  },
                }}
              >
                <Tab disableRipple value="all" label={getLangText(LANG_KEYS.DOCUMENT_FILTER_ALL)} />
                <Tab disableRipple value="included" label={getLangText(LANG_KEYS.DOCUMENT_FILTER_INCLUDED)} />
                <Tab disableRipple value="notIncluded" label={getLangText(LANG_KEYS.DOCUMENT_FILTER_NOT_INCLUDED)} />
              </Tabs>
              <Tooltip title={getLangText(LANG_KEYS.NEW_DOCUMENT)}>
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
                >
                  <IconButton
                    onClick={createDraft}
                    aria-label={getLangText(LANG_KEYS.NEW_DOCUMENT)}
                    disabled={!sessionId || api.isMutating}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
              </Tooltip>
            </Box>
            <Box sx={{ p: 1, pt: 0.5, backgroundColor: 'background.paper' }}>
              {isLoading ? (
                <Typography sx={{ p: 2 }}>{getLangText(LANG_KEYS.LOADING_DOCUMENTS)}</Typography>
              ) : filteredDocuments.length ? (
                <List disablePadding>
                  {filteredDocuments.map((document) => (
                    <ListItemButton
                      key={document.documentId}
                      selected={document.documentId === selected?.documentId}
                      onClick={() => {
                        if (document.documentId !== selected?.documentId) {
                          setComparison(undefined);
                          setIsComparisonVisible(true);
                          setRewriteInstruction('');
                        }
                        setSelectedId(document.documentId);
                      }}
                    >
                      <ListItemText
                        primary={document.title}
                        secondary={`${document.issuer ?? getLangText(LANG_KEYS.UNKNOWN_DOCUMENT_ISSUER)} · ${getDocumentStatusText(document.status)}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  {getLangText(documents.length ? LANG_KEYS.NO_FILTERED_DOCUMENTS : LANG_KEYS.NO_DOCUMENTS)}
                </Typography>
              )}
            </Box>
          </GlassCard>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selected && editor ? (
              <GlassCard variant="outlined" sx={{ height: 'auto' }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip
                      label={getDocumentStatusText(selected.status)}
                      color={selected.status === 'approved' ? 'success' : 'default'}
                      size="small"
                    />
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {getLangText(
                          selected.origin === 'manual'
                            ? LANG_KEYS.DOCUMENT_ORIGIN_MANUAL
                            : LANG_KEYS.DOCUMENT_ORIGIN_AI,
                        )}
                      </Typography>
                      {comparison?.documentId === selected.documentId && (
                        <Tooltip
                          title={getLangText(
                            isComparisonVisible
                              ? LANG_KEYS.HIDE_DOCUMENT_COMPARISON
                              : LANG_KEYS.SHOW_DOCUMENT_COMPARISON,
                          )}
                        >
                          <IconButton
                            size="small"
                            color={isComparisonVisible ? 'primary' : 'default'}
                            onClick={() => setIsComparisonVisible((visible) => !visible)}
                            aria-label={getLangText(
                              isComparisonVisible
                                ? LANG_KEYS.HIDE_DOCUMENT_COMPARISON
                                : LANG_KEYS.SHOW_DOCUMENT_COMPARISON,
                            )}
                          >
                            <DifferenceOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      select
                      label={getLangText(LANG_KEYS.DOCUMENT_CLAIM_MODE)}
                      value={editor.claimMode}
                      onChange={(event) =>
                        setEditor({ ...editor, claimMode: event.target.value as DocumentInfo['claimMode'] })
                      }
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    >
                      {DOCUMENT_CLAIM_MODES.map((claimMode) => (
                        <MenuItem key={claimMode} value={claimMode}>
                          {getDocumentClaimModeText(claimMode)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_EVENT_KEY)}
                      value={editor.eventKey}
                      onChange={(event) => setEditor({ ...editor, eventKey: event.target.value })}
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      type="number"
                      label={getLangText(LANG_KEYS.DOCUMENT_TIMELINE_ORDER)}
                      value={editor.timelineOrder ?? ''}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          timelineOrder: event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_IN_WORLD_TIME)}
                      value={editor.inWorldTime}
                      onChange={(event) => setEditor({ ...editor, inWorldTime: event.target.value })}
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label={getLangText(LANG_KEYS.DOCUMENT_TITLE)}
                    value={editor.title}
                    onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                    disabled={selected.status !== 'draft' || api.isMutating}
                    sx={approvedFieldSx}
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_KIND)}
                      value={editor.documentKind}
                      onChange={(event) => setEditor({ ...editor, documentKind: event.target.value })}
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    />
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_ISSUER)}
                      value={editor.issuer}
                      onChange={(event) => setEditor({ ...editor, issuer: event.target.value })}
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    />
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_VIEWPOINT)}
                      value={editor.viewpoint}
                      onChange={(event) => setEditor({ ...editor, viewpoint: event.target.value })}
                      disabled={selected.status !== 'draft' || api.isMutating}
                      sx={approvedFieldSx}
                      fullWidth
                    />
                  </Stack>
                  {selected.status === 'draft' ? (
                    <TextField
                      label={getLangText(LANG_KEYS.DOCUMENT_CONTENT)}
                      value={editor.body}
                      onChange={(event) => setEditor({ ...editor, body: event.target.value })}
                      multiline
                      minRows={14}
                      fullWidth
                      disabled={api.isMutating}
                    />
                  ) : (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {getLangText(LANG_KEYS.DOCUMENT_CONTENT)}
                      </Typography>
                      <SafeRichText text={editor.body} sx={{ mt: 0.5 }} />
                    </Box>
                  )}
                  {comparison?.documentId === selected.documentId && isComparisonVisible && (
                    <DocumentDiff before={editorToDiffText(comparison.before)} after={editorToDiffText(editor)} />
                  )}
                  {selected.status === 'draft' && (
                    <GlassPaper sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        {lastRequestText && (
                          <TextField
                            label={getLangText(LANG_KEYS.LAST_DOCUMENT_REQUEST)}
                            value={lastRequestText}
                            multiline
                            maxRows={3}
                            fullWidth
                            size="small"
                            slotProps={{ input: { readOnly: true } }}
                          />
                        )}
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                          <TextField
                            label={getLangText(LANG_KEYS.DOCUMENT_REWRITE_INSTRUCTION)}
                            value={rewriteInstruction}
                            onChange={(event) => setRewriteInstruction(event.target.value)}
                            multiline
                            minRows={2}
                            fullWidth
                            disabled={api.isMutating}
                            inputProps={{ maxLength: 5000 }}
                          />
                          <AiModelSelector
                            modelName={rewriteModelName}
                            onAiModel={setRewriteModelName}
                            models={modelCatalog?.models}
                            disabled={api.isMutating}
                          />
                          <GlassButton
                            startIcon={<AutoAwesomeOutlinedIcon />}
                            onClick={rewriteDraft}
                            disabled={api.isMutating || !rewriteInstruction.trim()}
                            sx={{ flexShrink: 0 }}
                          >
                            {getLangText(LANG_KEYS.REWRITE_DOCUMENT)}
                          </GlassButton>
                        </Stack>
                      </Stack>
                    </GlassPaper>
                  )}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editor.retrievalEnabled}
                        onChange={(_, checked) => void setRetrievalPreference(checked)}
                        disabled={selected.status === 'archived' || api.isMutating}
                      />
                    }
                    label={getLangText(LANG_KEYS.USE_IN_CONVERSATION_RAG)}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    {selected.status === 'draft' && (
                      <>
                        <GlassButton startIcon={<DeleteOutlineIcon />} onClick={deleteDraft} disabled={api.isMutating}>
                          {getLangText(LANG_KEYS.DELETE)}
                        </GlassButton>
                        <GlassButton startIcon={<SaveOutlinedIcon />} onClick={saveDraft} disabled={api.isMutating}>
                          {getLangText(LANG_KEYS.SAVE)}
                        </GlassButton>
                        <GlassButton
                          startIcon={<CheckIcon />}
                          onClick={approveDraft}
                          disabled={api.isMutating || !editor.body.trim()}
                        >
                          {getLangText(LANG_KEYS.APPROVE)}
                        </GlassButton>
                      </>
                    )}
                    {selected.status === 'approved' && (
                      <GlassButton
                        startIcon={<ArchiveOutlinedIcon />}
                        onClick={() => api.archive({ documentId: selected.documentId, sessionId })}
                        disabled={api.isMutating}
                      >
                        {getLangText(LANG_KEYS.ARCHIVE)}
                      </GlassButton>
                    )}
                  </Stack>
                </Stack>
              </GlassCard>
            ) : (
              <GlassCard sx={{ height: 'auto' }} contentProps={{ sx: { p: 3, '&:last-child': { pb: 3 } } }}>
                <Typography color="text.secondary">{getLangText(LANG_KEYS.SELECT_OR_CREATE_DOCUMENT)}</Typography>
              </GlassCard>
            )}
          </Box>
        </Stack>
      </Box>
    </>
  );
}
