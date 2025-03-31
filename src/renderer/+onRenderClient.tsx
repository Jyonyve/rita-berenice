import { renderToStream } from 'react-streaming/server';
import { escapeInject } from 'vike/server';
import { Layout } from './Layout';
import { getPageTitle } from './getPageTitle';
import type { OnRenderHtmlAsync } from 'vike/types';
import ReactDOM from 'react-dom/client';
import type { OnRenderClientAsync } from 'vike/types';

let root: ReactDOM.Root;
export const onRenderClient: OnRenderClientAsync = async (
	pageContext
): ReturnType<OnRenderClientAsync> => {
	const { Page } = pageContext;
	const page = (
		<Layout pageContext={pageContext}>
			<Page />
		</Layout>
	);
	const container = document.getElementById('root')!;
	if (pageContext.isHydration) {
		root = ReactDOM.hydrateRoot(container, page);
	} else {
		if (!root) {
			root = ReactDOM.createRoot(container);
		}
		root.render(page);
	}
	document.title = getPageTitle(pageContext);
};
