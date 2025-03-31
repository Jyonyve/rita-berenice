import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDevMiddleware } from 'vike/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function createServer() {
	const app = express();
	let vite;
	if (isProduction) {
		app.use(express.static(path.join(__dirname, 'dist/client')));
	} else {
		const { devMiddleware } = await createDevMiddleware({ root });
		app.use(devMiddleware);
		// vite = await createDevMiddleware({ server: { middlewareMode: 'ssr' }, appType: 'custom' });
		// app.use(vite.middlewares);
	}

	// Serve static files first
	app.use('*', async (req, res, next) => {
		const url = req.originalUrl;
		try {
			let template;
			let render;

			if (isProduction) {
				template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
				render = (await import('./dist/server/entry-server.mjs')).render;
			} else {
				template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
				template = await vite.transformIndexHtml(url, template);
				render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
			}

			const { appHtml, emotionCss } = await render(url);

			const html = template
				.replace('<!--emotion-css-->', emotionCss)
				.replace('<!--ssr-outlet-->', appHtml);

			res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
		} catch (e) {
			if (!isProduction && vite) {
				vite.ssrFixStacktrace(e);
			}
			console.error(e);
			next(e);
		}
	});

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}
createServer();
