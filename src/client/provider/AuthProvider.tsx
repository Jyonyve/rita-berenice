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
import { useMockAuthStore } from '../mock/index.js';

// --- Define the shape of our unified context ---
interface AuthContextType {
	isSessionLoading: boolean;
	isLoggedIn: boolean;
	isLoginModalOpen: boolean;
	openLoginModal: () => void;
	closeLoginModal: () => void;
	userId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const mockUserId = 'mock-user-id';
const isStatic = import.meta.env.VITE_APP_MODE === 'static';

// --- Create the single, intelligent provider ---
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
	// 1. Get the real session state from SuperTokens
	const session = useSessionContext();

	// 2. Get the mock session state from our external store (only in static mode)
	const { isLoggedIn: isMockLoggedIn } = useMockAuthStore(isStatic);

	// 3. Unify the session state into single variables
	const isSessionLoading = isStatic ? false : session.loading;
	const isLoggedIn = isStatic ? isMockLoggedIn : !session.loading && session.doesSessionExist;
	const userId =
		!session.loading && session.doesSessionExist ? session.userId : isLoggedIn ? mockUserId : '';

	// 4. Manage the modal state
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const openLoginModal = () => setIsLoginModalOpen(true);
	const closeLoginModal = () => setIsLoginModalOpen(false);

	// 5. Consolidate the effect to auto-close the modal upon login
	const prevIsLoggedIn = useRef(isLoggedIn);
	useEffect(() => {
		// If the user just transitioned to logged-in and the modal is open, close it.
		if (!prevIsLoggedIn.current && isLoggedIn && isLoginModalOpen) {
			closeLoginModal();
		}
		prevIsLoggedIn.current = isLoggedIn;
	}, [isLoggedIn, isLoginModalOpen, closeLoginModal]);

	const value: AuthContextType = {
		isSessionLoading,
		isLoggedIn,
		isLoginModalOpen,
		openLoginModal,
		closeLoginModal,
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
