// src/client/hooks/useDateFormatter.ts
import { useLanguage } from '../provider/LanguageProvider.js';

export const useDateFormatter = () => {
	const { lang } = useLanguage();

	const formatDate = (dateString: string) => {
		const locale = lang === 'kor' ? 'ko-KR' : 'en-US';

		return new Date(dateString).toLocaleDateString(locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	const formatDateTime = (dateString: string) => {
		const locale = lang === 'kor' ? 'ko-KR' : 'en-US';

		return new Date(dateString).toLocaleString(locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const formatRelativeDate = (dateString: string) => {
		const locale = lang === 'kor' ? 'ko-KR' : 'en-US';
		const date = new Date(dateString);
		const now = new Date();
		const daysDiff = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (daysDiff === 0) return lang === 'kor' ? '오늘' : 'Today';
		if (daysDiff === 1) return lang === 'kor' ? '어제' : 'Yesterday';
		if (daysDiff < 7) return lang === 'kor' ? `${daysDiff}일 전` : `${daysDiff} days ago`;

		return formatDate(dateString);
	};

	return {
		formatDate,
		formatDateTime,
		formatRelativeDate,
		currentLocale: lang === 'kor' ? 'ko-KR' : 'en-US',
	};
};
