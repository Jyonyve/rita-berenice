// src/client/style/AuthModal.tsx

import React, { createContext, useState, useContext, FC, ReactNode } from 'react';

// Define the shape of the context data
interface AuthModalContextType {
	isLoginModalOpen: boolean;
	openLoginModal: () => void;
	closeLoginModal: () => void;
}

// Create the context with an undefined initial value
const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

// Create the Provider component
export const AuthModalProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

	const openLoginModal = () => setIsLoginModalOpen(true);
	const closeLoginModal = () => setIsLoginModalOpen(false);

	const value = { isLoginModalOpen, openLoginModal, closeLoginModal };

	return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
};

// Create a custom hook for easy consumption of the context
export const useAuthModal = (): AuthModalContextType => {
	const context = useContext(AuthModalContext);
	if (context === undefined) {
		throw new Error('useAuthModal must be used within an AuthModalProvider');
	}
	return context;
};
