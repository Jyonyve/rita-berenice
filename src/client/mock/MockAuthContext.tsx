// src/hooks/useMockAuth.ts
import { useState, useEffect } from 'react';
import { mockAuthStore } from './mockAuthStore.js';
import { User } from 'supertokens-web-js/types/index.js';

export const useMockAuth = () => {
	// Use React state to hold the value from the store.
	const [isLoggedIn, setIsLoggedIn] = useState(mockAuthStore.getSnapshot());

	useEffect(() => {
		// When the component mounts, subscribe to the store.
		// The `subscribe` function returns the `unsubscribe` cleanup function.
		const unsubscribe = mockAuthStore.subscribe(setIsLoggedIn);

		// When the component unmounts, cleanup the subscription.
		return unsubscribe;
	}, []); // Empty dependency array ensures this runs only once.

	return { isLoggedIn, setLoggedIn: mockAuthStore.setLoggedIn };
};
