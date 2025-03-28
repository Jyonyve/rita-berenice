export type PageContextCommon = {
	Page: () => React.ReactElement;
	pageProps?: Record<string, unknown>;
	urlPathname: string;
	isHydration: boolean;
};

export type PageContextClient = PageContextCommon;

export type PageContextServer = PageContextCommon & { pageHtml: string };
