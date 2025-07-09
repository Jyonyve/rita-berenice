// src/client/context/LanguageProvider.tsx

import React, { createContext, useState, useContext, FC, ReactNode, useMemo } from 'react';
import { LangCode, DEFAULT_LANG } from '#shared/config/langConstants.js';

// Define the shape of the context data
interface LanguageContextType {
	lang: LangCode;
	toggleLang: () => void;
	setLang: (language: LangCode) => void;
}

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Create the Provider component
export const LanguageProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const [lang, setLang] = useState<LangCode>(DEFAULT_LANG); // Default to 'kor'

	const toggleLang = () => {
		setLang((prevLang) => (prevLang === 'kor' ? 'eng' : 'kor'));
	};

	// useMemo is used here for performance optimization, ensuring the context value
	// object is only recreated when the language actually changes.
	const value = useMemo(() => ({ lang, toggleLang, setLang }), [lang]);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// Create a custom hook for easy consumption of the context
export const useLanguage = (): LanguageContextType => {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error('useLanguage must be used within a LanguageProvider');
	}
	return context;
};
