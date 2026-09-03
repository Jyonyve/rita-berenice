import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useHistoryApi } from '../../hook/index.js';
import { PageQueryState } from '../../layout/component/PageQueryState.js';
import { useAuth } from '../../provider/index.js';
import { getLangText } from '../../util/translateUtils.js';
import HistoryPage from './HistoryPage.jsx';

export function HistoryPageLoader() {
  const navigate = useNavigate();
  const { historyId } = useParams();
  const { userId } = useAuth();

  useEffect(() => {
    if (!historyId) {
      navigate('/not-found-historyId', { replace: true });
    }
  }, [historyId, navigate]);

  const historyQuery = useHistoryApi().getHistory(historyId ?? '');

  if (!historyId) return null;

  if (historyQuery.isLoading) {
    return <PageQueryState mode="loading" message={getLangText(LANG_KEYS.LOADING_STORIES)} />;
  }

  if (historyQuery.isError || !historyQuery.data) {
    return (
      <PageQueryState
        mode="error"
        message={getLangText(LANG_KEYS.FAILED_LOAD_DATA)}
        onRetry={() => void historyQuery.refetch()}
        isRetrying={historyQuery.isFetching}
      />
    );
  }

  const historyRes = historyQuery.data;

  return (
    <HistoryPage
      historyInfo={historyRes.historyInfo}
      imageUrl={historyRes.historyImageUrls[historyRes.historyInfo.historyId]}
      userId={userId ?? ''}
    />
  );
}
