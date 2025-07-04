import { FC } from 'react';
import { useChatApi } from '../../hook/api/useChatApi.js';
import { useUserApi } from '../../hook/api/useUserApi.js';
import { TempChatTurn } from '#shared/domain/chat/ChatInterfaces.ts';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';

const SessionList: FC<{ sessionIds: string[] }> = ({ sessionIds }) => {
	const {
		data: tempTurnsResponse,
		isLoading,
		error,
	} = useChatApi().getLastTempTurnsForSessions(sessionIds);

	if (isLoading) return <p>Loading session previews...</p>;
	if (error) return <p>Error: {error.message}</p>;

	// 3. Render the list of sessions using the returned tempChatTurns.
	const renderTurnPreview = (turn: TempChatTurn) => {
		const turnSet =
			turn.fixedSetNo < 0 ? turn.chatTurnSets.at(-1) : turn.chatTurnSets[turn.fixedSetNo];
		return <p>{parseEntriesToText(turnSet?.response.entries || []).slice(0, 140)}</p>;
	};
	return (
		<div>
			{tempTurnsResponse?.tempChatTurns.map((turn) => (
				<div key={`${turn.sessionId}_preview`}>
					<h3>{`${turn.chatTurnSets[0].request.showName} X ${turn.chatTurnSets[0].response.showName}`}</h3>
					{renderTurnPreview(turn)}
				</div>
			))}
		</div>
	);
};
