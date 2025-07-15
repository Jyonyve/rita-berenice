// src/client/mock/mockAuthStore.ts

import { NavigateFunction } from 'react-router';

// This file remains unchanged.
let isMockLoggedIn = false;
let navigate: NavigateFunction | null = null;
const listeners = new Set<(isLoggedIn: boolean) => void>();

const notifySuperTokens = () => {
	setTimeout(() => window.dispatchEvent(new Event('superTokensSessionUpdate')), 0);
};

export const mockAuthStore = {
	setLoggedIn: (value: boolean) => {
		isMockLoggedIn = value;
		listeners.forEach((listener) => listener(isMockLoggedIn));
		notifySuperTokens();
	},
	subscribe: (listener: (isLoggedIn: boolean) => void) => {
		listeners.add(listener);

		return () => {
			listeners.delete(listener);
		};
	},
	getSnapshot: () => isMockLoggedIn,
	setNavigate: (navigateFn: NavigateFunction) => {
		navigate = navigateFn;
	},
	handleNavigation: (path: string) => {
		if (navigate) {
			navigate(path);
		}
	},

	// --- NEW ---
	// Method to register the navigate function from our React app
	setNavigate: (navigateFn: NavigateFunction) => {
		mockNavigate = navigateFn;
	},
	// Method to perform client-side navigation
	handleNavigation: (path: string) => {
		if (mockNavigate) {
			console.log(`[Mock Auth] Navigating to ${path} using React Router.`);
			mockNavigate(path);
			window.history.replaceState({}, '', import.meta.env.BASE_URL);
		} else {
			console.error('Navigate function not set. Cannot perform client-side navigation.');
			setTimeout(() => mockAuthStore.handleNavigation(path), 20);
		}
	},
	setNavigate: (navigateFn: NavigateFunction) => {
		mockNavigate = navigateFn;
	},
};
