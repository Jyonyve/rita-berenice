// src/client/provider/AuthProvider.tsx

import React, {
	createContext,
	useState,
	useContext,
	FC,
	ReactNode,
	useEffect,
	useRef,
	useCallback,
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
	createUserProfile: () => Promise<void>;
	refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Create the single, intelligent provider ---
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
	// 1. Hooks and State
	const session = useSessionContext();
	const { getUser, storeUser } = useUserApi();

	// Session-derived state
	const isSessionLoading = session.loading;
	const isLoggedIn = !session.loading && session.doesSessionExist;
	const userId = isLoggedIn ? session.userId : undefined;

	// Modal state
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const openLoginModal = () => setIsLoginModalOpen(true);
	const closeLoginModal = () => setIsLoginModalOpen(false);

	// Profile state
	const [userProfile, setUserProfile] = useState<UserInfo>();
	const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

	// --- React Query for User Data ---
	// This hook is the single source of truth for the current user's profile data.
	const {
		data: userQueryData,
		refetch: refetchUserQuery,
		isLoading: isUserQueryLoading, // Use this to track loading state
	} = getUser(userId || ''); // Pass userId, or empty string to keep it disabled until userId is available

	// 2. Core Logic Functions

	// This is now the primary function to get the latest user profile and update the auth state.
	const fetchAndSetUserProfile = useCallback(
		async (currentUserId: string) => {
			// console.log(`🔵 [Auth] Fetching profile for userId: ${currentUserId}`);
			try {
				// Use the refetch function from useQuery to guarantee fresh data
				const { data: freshUserData } = await refetchUserQuery();
				// console.log('✅ [Auth] Fetched user data:', freshUserData);

				if (freshUserData?.userInfo) {
					// console.log('✅ [Auth] User profile found. Setting state.');
					setUserProfile(freshUserData.userInfo);
					setNeedsProfileSetup(false);
				} else {
					// console.log('🟡 [Auth] User profile NOT found in DB. User needs profile setup.');
					setUserProfile(undefined);
					setNeedsProfileSetup(true);
				}
			} catch (error) {
				console.error('❌ [Auth] Error fetching user profile:', error);
				setUserProfile(undefined);
				setNeedsProfileSetup(true); // Assume setup is needed on error
			}
		},
		[refetchUserQuery]
	);

	// This function now only triggers the mutation. The state update is handled by the useEffect hook.
	const createUserProfile = async (): Promise<void> => {
		const email = !session.loading && session.accessTokenPayload?.email;
		if (!userId || !email) {
			console.error('❌ [Auth] Cannot create profile: Missing userId or email.');
			throw new Error('User ID or email is not available to create a profile.');
		}

		// console.log(`🔵 [Auth] Creating/storing profile for userId: ${userId} with email: ${email}`);
		try {
			await storeUser({ userId, email });
			console.log(
				'✅ [Auth] storeUser mutation successful. The `onSuccess` callback will invalidate and trigger a refetch.'
			);
			// We don't need to manually refetch here if the mutation's onSuccess invalidates the query.
			// The useEffect will catch the data change.
		} catch (error) {
			console.error('❌ [Auth] Failed to store user profile:', error);
		}
	};

	// Exposed function to allow other parts of the app to trigger a manual refresh.
	const refetchProfile = useCallback(() => {
		if (userId) {
			fetchAndSetUserProfile(userId);
		}
	}, [userId, fetchAndSetUserProfile]);

	const logout = async (): Promise<void> => {
		console.log('🔵 [Auth] Logging out user...');
		await signOut();
		// State cleanup is handled by the main useEffect below when `isLoggedIn` becomes false.
	};

	// 3. Effects
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

	// Main effect to sync the user profile with the React Query data source
	useEffect(() => {
		// console.log('🔵 [Auth] Query data changed:', userQueryData);
		if (isLoggedIn && !isUserQueryLoading) {
			if (userQueryData?.userInfo) {
				setUserProfile(userQueryData.userInfo);
				setNeedsProfileSetup(false);
			} else if (!userQueryData) {
				// This handles the case where the user is logged in but has no profile in our DB
				setNeedsProfileSetup(true);
			}
		}
	}, [userQueryData, isLoggedIn, isUserQueryLoading]);

	// Effect to check the profile when the session is first established
	useEffect(() => {
		if (isLoggedIn && userId) {
			console.log('🔵 [Auth] Session is active. Initial check/fetch of profile.');
			fetchAndSetUserProfile(userId);
		} else if (!isLoggedIn && !isSessionLoading) {
			console.log('🔵 [Auth] Session ended. Clearing profile state.');
			setUserProfile(undefined);
			setNeedsProfileSetup(false);
		}
	}, [isLoggedIn, userId, isSessionLoading, fetchAndSetUserProfile]);

	// Effect to close login modal automatically
	const prevIsLoggedIn = useRef(isLoggedIn);
	useEffect(() => {
		if (!prevIsLoggedIn.current && isLoggedIn && isLoginModalOpen) {
			closeLoginModal();
		}
		prevIsLoggedIn.current = isLoggedIn;
	}, [isLoggedIn, isLoginModalOpen]);

	// 4. Context Value and Provider
	const value: AuthContextType = {
		// Combine SuperTokens loading state with our profile loading state
		isSessionLoading: isSessionLoading || (isLoggedIn && isUserQueryLoading),
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
