// src/client/hooks/useMockAuthStore.ts

import { useState, useEffect } from 'react';
import { mockAuthStore } from './mockAuthStore.ts';

// This hook subscribes to the external store and provides its state to React.
export const useMockAuthStore = (isStatic: boolean) => {
	// Get the initial value.
	const [isLoggedIn, setIsLoggedIn] = useState(mockAuthStore.getSnapshot());

	useEffect(() => {
		// Only subscribe if we are in static mode.
		if (!isStatic) return;

		// The subscribe function returns an `unsubscribe` function for cleanup.
		const unsubscribe = mockAuthStore.subscribe(setIsLoggedIn);
		return unsubscribe;
	}, [isStatic]);

	return { isLoggedIn };
};
