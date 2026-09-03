import { LANG_KEYS } from '@rita-berenice/shared/config';
import { useCharacterApi, useCredentialApi, useSessionApi, useUserApi } from '../../hook/index.js';
import { PageQueryState } from '../../layout/component/PageQueryState.js';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { getLangText } from '../../util/translateUtils.js';
import { UserPage } from './UserPage.jsx';

export function UserPageLoader() {
  const { userId } = useAuth();
  const queryUserId = userId ?? '';
  const userQuery = useUserApi().getMe(!!userId);
  const characterQuery = useCharacterApi().getCharactersByUserId(queryUserId);
  const sessionQuery = useSessionApi().getSessionsByUserId(queryUserId);
  const credentialQuery = useCredentialApi().getUserApiKeyMetadata(queryUserId);
  const queries = [userQuery, characterQuery, sessionQuery, credentialQuery];
  const userRes = userQuery.data;
  const characterRes = characterQuery.data;
  const sessionRes = sessionQuery.data;
  const credentialRes = credentialQuery.data;

  if (!userId || queries.some((query) => query.isLoading)) {
    return <PageQueryState mode="loading" message={getLangText(LANG_KEYS.LOADING_USER)} />;
  }

  const hasLoadFailure =
    queries.some((query) => query.isError) || !userRes || !characterRes || !sessionRes || !credentialRes;

  if (hasLoadFailure) {
    return (
      <PageQueryState
        mode="error"
        message={getLangText(LANG_KEYS.FAILED_LOAD_DATA)}
        onRetry={() => {
          void Promise.all(queries.map((query) => query.refetch()));
        }}
        isRetrying={queries.some((query) => query.isFetching)}
      />
    );
  }

  return (
    <UserPage
      userInfo={userRes.userInfo}
      myCharacters={characterRes.characterInfos}
      mySessions={sessionRes.sessionInfos}
      configuredKeyTypes={credentialRes.configuredKeyTypes}
      isMine={userRes.userInfo.userId === userId}
    />
  );
}

export default UserPageLoader;
