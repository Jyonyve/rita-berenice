import { useLocation } from 'react-router';
import { CHARACTER_VISIBILITY, LANG_KEYS } from '@rita-berenice/shared/config';
import { useCharacterApi } from '../../hook/api/index.js';
import { useAuth } from '../../provider/AuthProvider.tsx';
import { PageQueryState } from '../../layout/component/PageQueryState.js';
import { getLangText } from '../../util/translateUtils.js';
import { CharacterListPage } from './CharacterListPage.jsx';

export function CharacterListPageLoader() {
  const { state } = useLocation();
  const { userId } = useAuth();
  const { getAllCharacters, getCharactersByUserId } = useCharacterApi();
  const isMine = !!state?.isMine;

  const characterQuery = isMine && userId ? getCharactersByUserId(userId) : getAllCharacters();

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

  // Defense-in-depth alongside server-side filtering: hide private characters
  // that the current user does not own.
  const filteredCharacters = characterQuery.data.characterInfos.filter(
    (character) => character.userId === userId || character.visibility !== CHARACTER_VISIBILITY.PRIVATE,
  );

  return (
    <CharacterListPage
      characterInfos={filteredCharacters}
      characterPortraits={characterQuery.data.characterPortraits}
    />
  );
}
