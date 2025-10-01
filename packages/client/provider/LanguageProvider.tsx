// Enhanced LanguageProvider with Korean-first detection
import React, {
	createContext,
	useState,
	useContext,
	FC,
	ReactNode,
	useMemo,
	useEffect,
} from 'react';
import { LangCode, DEFAULT_LANG } from '@rita-berenice/shared/config/langConstants.js';
import { fetchWithTimeout } from '../util/fetchUtils.js';
import { setCurrentLang } from '../util/translateUtils.js';

interface LanguageContextType {
	lang: LangCode;
	toggleLang: () => void;
	setLang: (language: LangCode) => void;
}
interface LanguageProviderProps {
	children: ReactNode;
	initialLang?: LangCode;
}
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Korean-priority detection function
const detectLanguageWithKoreanPriority = async (): Promise<LangCode> => {
	// Get browser language
	const browserLang = typeof window !== 'undefined' ? navigator.language || '' : '';

	// Priority 1: If browser language is Korean (ko-KR, ko, etc.)
	if (browserLang.toLowerCase().startsWith('ko')) {
		return 'kor';
	}

	// Priority 2: Check if user is located in Korea
	try {
		const countryCode = await getUserCountry();
		if (countryCode === 'KR') {
			return 'kor'; // Korean in Korea with English browser → Korean app
		}
	} catch (error) {
		console.warn('Failed to detect location:', error);
	}

	// Priority 3: All other cases use default language
	return DEFAULT_LANG; // 'eng' or whatever your default is
};
// Correct implementation with AbortController
const getUserCountry = async (): Promise<string | null> => {
	try {
		const response = await fetchWithTimeout('https://ipapi.co/country_code/', {}, 3000);

		if (response.ok) {
			const countryCode = await response.text();
			return countryCode.trim().toUpperCase();
		}

		throw new Error('IP service failed');
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				console.warn('Request timed out after 3 seconds');
			}

			// Fallback service
			try {
				const response = await fetchWithTimeout('https://ipinfo.io/country', {}, 3000);
				const countryCode = await response.text();
				return countryCode.trim().toUpperCase();
			} catch (fallbackError) {
				console.warn('All country detection services failed');
			}
		}
		console.warn('Unknown error:', error);
		return null;
	}
};

export const LanguageProvider: FC<LanguageProviderProps> = ({ children, initialLang }) => {
	// 🎯 USE SERVER-DETECTED LANGUAGE AS INITIAL STATE
	const getInitialLang = (): LangCode => {
		// Priority 1: Server-detected language (from SSR)
		if (initialLang) {
			return initialLang;
		}

		// Priority 2: Stored user preference
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('user-preferred-language') as LangCode;
			if (stored === 'kor' || stored === 'eng') {
				return stored;
			}
		}

		return DEFAULT_LANG;
	};

	const [lang, setLang] = useState<LangCode>(getInitialLang);

	// Background enhancement only if no server detection
	useEffect(() => {
		if (!initialLang) {
			detectLanguageWithKoreanPriority().then((detectedLang) => {
				const hasUserPreference = localStorage.getItem('user-preferred-language');
				if (!hasUserPreference) {
					setLang(detectedLang);
				}
			});
		}
	}, [initialLang]);

	useEffect(() => {
		setCurrentLang(lang); // Update global state
	}, [lang]);

	// Enhanced setLang with global state sync
	const setLangWithSync = (language: LangCode) => {
		setLang(language); // Update React state
		setCurrentLang(language); // Update global state

		// Save user's manual choice
		if (typeof window !== 'undefined') {
			localStorage.setItem('user-preferred-language', language);
		}
	};

	const toggleLang = () => {
		const newLang = lang === 'kor' ? 'eng' : 'kor';
		setLangWithSync(newLang);
	};

	const value = useMemo(() => ({ lang, toggleLang, setLang: setLangWithSync }), [lang]);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error('useLanguage must be used within a LanguageProvider');
	}
	return context;
};
