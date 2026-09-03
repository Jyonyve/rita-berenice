import { useQuery } from '@tanstack/react-query';
import type { ModelCatalogResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';

const MODEL_CATALOG_STALE_TIME_MS = 15 * 60 * 1000;

export const useLlmApi = () => {
  const getModelCatalog = () =>
    useQuery<ModelCatalogResponse, Error>({
      queryKey: ['llm', 'getModelCatalog'],
      queryFn: async () => {
        const response = await apiClient.get<ModelCatalogResponse>(genApiUrl(MODULE_NAMES.LLM, 'getModelCatalog'));
        return response.data;
      },
      staleTime: MODEL_CATALOG_STALE_TIME_MS,
    });

  return { getModelCatalog };
};
