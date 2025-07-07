// src/client/hooks/useCharacterState.ts

import { useState, useEffect, useRef } from 'react';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

export const useProfileState = (profileId: string, info?: ProfileInfo) => {
	// --- Hooks called at TOP LEVEL (Correct) ---
	const [profileInfo, setProfileInfo] = useState<ProfileInfo>();

	useEffect(() => {
		if (profileId && profileInfo && profileId === profileInfo.profileId) {
			setProfileInfo(info);
		} else {
			setProfileInfo(undefined);
		}
	}, [profileId, profileInfo]);

	return { profileInfo };
};
