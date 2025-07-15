// src/client/mock/supertokensMockState.ts
let isLoggedIn = false;

export function setMockLoggedIn(value: boolean) {
	isLoggedIn = value;
	localStorage.setItem('mockLoggedIn', value ? '1' : '0');
}
export function getMockLoggedIn() {
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem('mockLoggedIn');
		if (stored !== null) return stored === '1';
	}
	return isLoggedIn;
}
