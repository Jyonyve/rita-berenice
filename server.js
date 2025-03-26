import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5173;

async function createServer() {
	const app = express();
	const vite = await createViteServer({ server: { middlewareMode: 'ssr' }, appType: 'custom' });
	app.use(vite.middlewares);

	// Serve static files first
	app.use('*', async (req, res, next) => {
		const url = req.originalUrl;
		try {
			// 1. index.html 파일을 읽어들입니다.
			let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

			// 2. Vite의 HTML 변환 작업을 통해 Vite HMR 클라이언트를 주입하고,
			//    Vite 플러그인의 HTML 변환도 적용합니다.
			//    (예: @vitejs/plugin-react의 전역 초기화 코드)
			template = await vite.transformIndexHtml(url, template);

			// 3. 서버의 진입점(Entry)을 로드합니다.
			//    ssrLoadModule은 Node.js에서 사용할 수 있도록 ESM 소스 코드를 자동으로 변환합니다.
			//    추가적인 번들링이 필요하지 않으며, HMR과 유사한 동작을 수행합니다.
			const { render } = await vite.ssrLoadModule('/src/entry-server.js');

			// 4. 앱의 HTML을 렌더링합니다.
			//    이는 entry-server.js에서 내보낸(Export) `render` 함수가
			//    ReactDOMServer.renderToString()과 같은 적절한 프레임워크의 SSR API를 호출한다고 가정합니다.
			const appHtml = await render(url);

			// 5. 렌더링된 HTML을 템플릿에 주입합니다.
			const html = template.replace(`<!--ssr-outlet-->`, () => appHtml);

			// 6. 렌더링된 HTML을 응답으로 전송합니다.
			res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
		} catch (e) {
			// 만약 오류가 발생된다면, Vite는 스택트레이스(Stacktrace)를 수정하여
			// 오류가 실제 코드에 매핑되도록 재구성합니다.
			vite.ssrFixStacktrace(e);
			next(e);
		}
	});

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}

// // SSR Handler
// app.get('*', async (req, res) => {
// 	try {
// 		const indexPath = path.join(__dirname, 'dist', 'index.html');
// 		let html = fs.readFileSync(indexPath, 'utf-8');

// 		const appHtml = renderApp();

// 		// Insert the rendered app HTML
// 		html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

// 		// Insert the client-side script
// 		// html = html.replace('</body>', `<script type="module" src="/main.mjs"></script></body>`);

// 		res.send(html);
// 	} catch (error) {
// 		console.error('SSR Error:', error);
// 		res.status(500).send('Server error');
// 	}
// });
