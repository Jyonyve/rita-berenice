import { useState } from 'react';
export const useChromaDB = () => {
	// state
	const [sessionId, setSessionId] = useState<string>();

	const changeSessionId = (newSessionId: string) => {
		newSessionId && setSessionId(newSessionId);
	};

	return { sessionId, changeSessionId };
};
