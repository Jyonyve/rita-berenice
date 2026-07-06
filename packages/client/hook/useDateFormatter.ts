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

		// Calculate days difference more accurately
		// Set both dates to start of day (midnight) to compare only dates, not times
		const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		const daysDiff = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

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
