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

		// Use the locale for proper formatting
		const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

		if (daysDiff === 0) return rtf.format(0, 'day'); // "today" / "오늘"
		if (daysDiff === 1) return rtf.format(-1, 'day'); // "yesterday" / "어제"
		if (daysDiff < 7) return rtf.format(-daysDiff, 'day'); // "3 days ago" / "3일 전"

		return formatDate(dateString);
	};

	return {
		formatDate,
		formatDateTime,
		formatRelativeDate,
		currentLocale: lang === 'kor' ? 'ko-KR' : 'en-US',
	};
};
