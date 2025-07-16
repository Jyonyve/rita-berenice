// src/client/mock/mockAuthStore.ts

import { NavigateFunction } from 'react-router';

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
};
