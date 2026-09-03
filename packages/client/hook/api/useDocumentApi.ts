import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentResponse } from '@rita-berenice/shared/api';
import type {
  DocumentDraftRewrite,
  DocumentDraftUpdate,
  GeneratedDocumentDraftCreate,
  ManualDocumentDraftCreate,
} from '@rita-berenice/shared/domain';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';

const documentListKey = (sessionId: string) => ['documents', 'list', sessionId] as const;

export const useDocumentApi = () => {
  const queryClient = useQueryClient();
  const invalidateSession = (sessionId: string) =>
    queryClient.invalidateQueries({ queryKey: documentListKey(sessionId) });

  const getDocumentsBySession = (sessionId: string) =>
    useQuery<DocumentResponse, Error>({
      queryKey: documentListKey(sessionId),
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'getDocumentsBySession', [sessionId]);
        return (await apiClient.get<DocumentResponse>(url)).data;
      },
      enabled: !!sessionId,
    });

  const createManualDraft = useMutation<DocumentResponse, Error, ManualDocumentDraftCreate>({
    mutationFn: async (input) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'createManualDraft');
      return (await apiClient.post<DocumentResponse>(url, input)).data;
    },
    onSuccess: (_, input) => invalidateSession(input.sessionId),
  });

  const generateDraft = useMutation<DocumentResponse, Error, GeneratedDocumentDraftCreate>({
    mutationFn: async (input) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'generateDraft');
      return (await apiClient.post<DocumentResponse>(url, input)).data;
    },
    onSuccess: (_, input) => invalidateSession(input.sessionId),
  });

  const updateDraft = useMutation<
    DocumentResponse,
    Error,
    { documentId: string; sessionId: string; input: DocumentDraftUpdate }
  >({
    mutationFn: async ({ documentId, input }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'updateDraft', [documentId]);
      return (await apiClient.patch<DocumentResponse>(url, input)).data;
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  const rewriteDraft = useMutation<
    DocumentResponse,
    Error,
    { documentId: string; sessionId: string; input: DocumentDraftRewrite }
  >({
    mutationFn: async ({ documentId, input }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'rewriteDraft', [documentId]);
      return (await apiClient.post<DocumentResponse>(url, input)).data;
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  const approve = useMutation<DocumentResponse, Error, { documentId: string; sessionId: string }>({
    mutationFn: async ({ documentId }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'approve', [documentId]);
      return (await apiClient.post<DocumentResponse>(url)).data;
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  const archive = useMutation<DocumentResponse, Error, { documentId: string; sessionId: string }>({
    mutationFn: async ({ documentId }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'archive', [documentId]);
      return (await apiClient.post<DocumentResponse>(url)).data;
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  const setRetrievalPreference = useMutation<
    DocumentResponse,
    Error,
    { documentId: string; sessionId: string; enabled: boolean }
  >({
    mutationFn: async ({ documentId, enabled }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'setRetrievalPreference', [documentId]);
      return (await apiClient.put<DocumentResponse>(url, { enabled })).data;
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  const deleteDraft = useMutation<void, Error, { documentId: string; sessionId: string }>({
    mutationFn: async ({ documentId }) => {
      const url = genApiUrl(MODULE_NAMES.DOCUMENT, 'deleteDraft', [documentId]);
      await apiClient.delete(url);
    },
    onSuccess: (_, variables) => invalidateSession(variables.sessionId),
  });

  return {
    getDocumentsBySession,
    createManualDraft: createManualDraft.mutateAsync,
    generateDraft: generateDraft.mutateAsync,
    updateDraft: updateDraft.mutateAsync,
    rewriteDraft: rewriteDraft.mutateAsync,
    approve: approve.mutateAsync,
    archive: archive.mutateAsync,
    setRetrievalPreference: setRetrievalPreference.mutateAsync,
    deleteDraft: deleteDraft.mutateAsync,
    isGenerating: generateDraft.isPending || rewriteDraft.isPending,
    isMutating:
      createManualDraft.isPending ||
      generateDraft.isPending ||
      updateDraft.isPending ||
      rewriteDraft.isPending ||
      approve.isPending ||
      archive.isPending ||
      setRetrievalPreference.isPending ||
      deleteDraft.isPending,
  };
};
