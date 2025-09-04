// src/client/provider/AuthProvider.tsx

import React, {
	createContext,
	useState,
	useContext,
	FC,
	ReactNode,
	useEffect,
	useRef,
} from 'react';
import { useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';
import { signOut } from 'supertokens-auth-react/recipe/session/index.js';
import { UserInfo, UserCdo } from '#shared/domain/user/UserInterfaces.js';
import { useUserApi } from '../hook/api/useUserApi.js';
import { cryptoState } from '../cryptoState.js';

// --- Define the shape of our unified context ---
interface AuthContextType {
	isSessionLoading: boolean;
	isLoggedIn: boolean;
	isLoginModalOpen: boolean;
	openLoginModal: () => void;
	closeLoginModal: () => void;
	logout: () => Promise<void>;
	userId?: string;
	userProfile?: UserInfo;
	needsProfileSetup: boolean;
	createUserProfile: (userData: UserCdo) => Promise<void>;
	refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Create the single, intelligent provider ---
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
	// 1. Get the real session state from SuperTokens
	const session = useSessionContext();
	const { getUser, storeUser } = useUserApi();

	// 2. Unify the session state into single variables
	const isSessionLoading = session.loading;
	const isLoggedIn = !session.loading && session.doesSessionExist;
	const userId = !session.loading && session.doesSessionExist ? session.userId : undefined;

	// 3. Manage the modal state
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const openLoginModal = () => setIsLoginModalOpen(true);
	const closeLoginModal = () => setIsLoginModalOpen(false);

	// 4. New user profile state
	const [userProfile, setUserProfile] = useState<UserInfo>();
	const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

	// --- NEW: Public Key State Management ---
	useEffect(() => {
		async function fetchAndStoreKey() {
			try {
				const response = await fetch('/api/login/get-public-key');
				if (!response.ok) {
					throw new Error(`Failed to fetch public key: ${response.statusText}`);
				}
				const jwk = await response.json();
				const key = await window.crypto.subtle.importKey(
					'jwk',
					jwk,
					{ name: 'RSA-OAEP', hash: 'SHA-256' },
					true,
					['encrypt']
				);
				// --- CRITICAL: Store the key in the shared state object ---
				cryptoState.publicKey = key;
			} catch (error) {
				console.error('Failed to fetch public key:', error);
			}
		}
		fetchAndStoreKey();
	}, []);

	// 5. Function to create user profile using existing storeUser
	const createUserProfile = async (): Promise<void> => {
		const email = (!session.loading && session.accessTokenPayload?.email) || '';
		if (!userId) throw new Error('No user ID available');
		if (!email) throw new Error('No email available');
		await storeUser({ userId, email });
		const { data: userRes } = getUser(userId);
		const info = userRes?.userInfo;

		setUserProfile(info);
		setNeedsProfileSetup(false);
	};

	// 6. Function to refetch profile
	const refetchProfile = () => {
		if (userId) {
			checkUserProfile(userId);
		}
	};

	// 7. Helper to check user profile
	const checkUserProfile = async (currentUserId: string) => {
		try {
			const { data: userResponse } = getUser(currentUserId);
			if (userResponse?.userInfo) {
				setUserProfile(userResponse.userInfo);
				setNeedsProfileSetup(false);
			} else {
				setUserProfile(undefined);
				setNeedsProfileSetup(true);
			}
		} catch (error) {
			// User doesn't exist in your database - needs setup
			setUserProfile(undefined);
			setNeedsProfileSetup(true);
		}
	};

	// 8. Enhanced logout function
	const logout = async (): Promise<void> => {
		try {
			await signOut();
			closeLoginModal();
			// Clear user profile state on logout
			setUserProfile(undefined);
			setNeedsProfileSetup(false);
		} catch (error) {
			console.error('Logout failed:', error);
			throw error;
		}
	};

	// 9. Auto-close modal upon login (unchanged)
	const prevIsLoggedIn = useRef(isLoggedIn);
	useEffect(() => {
		if (!prevIsLoggedIn.current && isLoggedIn && isLoginModalOpen) {
			closeLoginModal();
		}
		prevIsLoggedIn.current = isLoggedIn;
	}, [isLoggedIn, isLoginModalOpen]);

	// 10. Check user profile when session changes
	useEffect(() => {
		if (isLoggedIn && userId && !userProfile) {
			checkUserProfile(userId);
		} else if (!isLoggedIn) {
			// Clear profile state when logged out
			setUserProfile(undefined);
			setNeedsProfileSetup(false);
		}
	}, [isLoggedIn, userId]);

	const value: AuthContextType = {
		isSessionLoading,
		isLoggedIn,
		isLoginModalOpen,
		openLoginModal,
		closeLoginModal,
		logout,
		userId,
		userProfile,
		needsProfileSetup,
		createUserProfile,
		refetchProfile,
	};
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Create the single, simple consumer hook ---
export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
