import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useCharacterApi } from '../../hook/index.js';
import { PageQueryState } from '../../layout/component/PageQueryState.js';
import { GlassPaper } from '../../layout/component/glass/index.js';
import { useAuth } from '../../provider/index.js';
import { routeConstants } from '../../routeConstants.js';
import { getLangText } from '../../util/translateUtils.js';
import { CharacterForm } from './CharacterForm.jsx';

export const EditCharacterPageLoader = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { characterId } = useParams<{ characterId: string }>();

  useEffect(() => {
    if (!characterId) {
      navigate('/not-found-characterId', { replace: true });
    }
  }, [characterId, navigate]);

  const characterQuery = useCharacterApi().getCharacter(characterId ?? '');

  if (!characterId || !userId) return null;

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
  const handleGoCharacterPage = () => navigate(`/${routeConstants.CHARACTER}/${characterId}`);

  return (
    <GlassPaper>
      <CharacterForm
        mode="edit"
        characterInfo={characterRes.characterInfo}
        portraitUrls={characterRes.characterPortraits[characterId]}
        avatarUrls={characterRes.characterAvatars[characterId]}
        userId={userId}
        onCancel={handleGoCharacterPage}
        onSuccess={handleGoCharacterPage}
      />
    </GlassPaper>
  );
};
