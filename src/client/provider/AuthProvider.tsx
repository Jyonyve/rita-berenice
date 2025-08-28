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

// --- Define the shape of our unified context ---
interface AuthContextType {
	isSessionLoading: boolean;
	isLoggedIn: boolean;
	isLoginModalOpen: boolean;
	openLoginModal: () => void;
	closeLoginModal: () => void;
	logout: () => Promise<void>;
	userId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Create the single, intelligent provider ---
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
	// 1. Get the real session state from SuperTokens
	const session = useSessionContext();

	// 2. Unify the session state into single variables
	const isSessionLoading = session.loading;
	const isLoggedIn = !session.loading && session.doesSessionExist;
	const userId = !session.loading && session.doesSessionExist ? session.userId : '';

	// 3. Manage the modal state
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const openLoginModal = () => setIsLoginModalOpen(true);
	const closeLoginModal = () => setIsLoginModalOpen(false);

	// 4. Add logout function that integrates with SuperTokens
	const logout = async (): Promise<void> => {
		try {
			await signOut();
			closeLoginModal();
		} catch (error) {
			console.error('Logout failed:', error);
			throw error;
		}
	};

	// 5. Auto-close modal upon login
	const prevIsLoggedIn = useRef(isLoggedIn);
	useEffect(() => {
		if (!prevIsLoggedIn.current && isLoggedIn && isLoginModalOpen) {
			closeLoginModal();
		}
		prevIsLoggedIn.current = isLoggedIn;
	}, [isLoggedIn, isLoginModalOpen]);

	// useEffect #7 REMOVED - no longer needed for production

	const value: AuthContextType = {
		isSessionLoading,
		isLoggedIn,
		isLoginModalOpen,
		openLoginModal,
		closeLoginModal,
		logout,
		userId,
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
