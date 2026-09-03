import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useCharacterApi } from '../../hook/index.js';
import { PageQueryState } from '../../layout/component/PageQueryState.js';
import { useAuth } from '../../provider/index.js';
import { getLangText } from '../../util/translateUtils.js';
import CharacterPage from './CharacterPage.jsx';

export function CharacterPageLoader() {
  const navigate = useNavigate();
  const { characterId } = useParams();
  const { userId } = useAuth();

  useEffect(() => {
    if (!characterId) {
      navigate('/not-found-characterId', { replace: true });
    }
  }, [characterId, navigate]);

  const characterQuery = useCharacterApi().getCharacter(characterId ?? '');

  if (!characterId) return null;

  if (characterQuery.isLoading) {
    return <PageQueryState mode="loading" message={getLangText(LANG_KEYS.LOADING_CHARACTERS)} />;
  }

  if (characterQuery.isError || !characterQuery.data) {
    return (
      <PageQueryState
        mode="error"
        message={getLangText(LANG_KEYS.FAILED_LOAD_DATA)}
        onRetry={() => void characterQuery.refetch()}
        isRetrying={characterQuery.isFetching}
      />
    );
  }

  const characterRes = characterQuery.data;
  const isMine = !!(userId && userId === characterRes.characterInfo.userId);

  return (
    <CharacterPage
      characterInfo={characterRes.characterInfo}
      portraitUrls={characterRes.characterPortraits[characterId]}
      avatarUrls={characterRes.characterAvatars[characterId]}
      userId={userId || ''}
      isMine={isMine}
    />
  );
}
