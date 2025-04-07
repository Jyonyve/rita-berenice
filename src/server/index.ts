import express from 'express';
import compression from 'compression';
import { renderPage } from 'vike/server'; // Use renderPage directly from vike
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function startServer() {
	const app = express();

	// Middleware for compression and JSON parsing
	app.use(compression());
	app.use(express.json());

	// Serve static files in production
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		app.use(express.static(`${root}/dist/client`));
	} else {
		// In development, use Vite's dev middleware
		const vite = await import('vite');
		const viteDevMiddleware = (await vite.createServer({ root, server: { middlewareMode: true } }))
			.middlewares;
		app.use(viteDevMiddleware);
	}

	// Handle all requests with Vike's renderPage
	app.get('*', async (req, res, next) => {
		const pageContextInit = { urlOriginal: req.originalUrl };
		const pageContext = await renderPage(pageContextInit);
		const { httpResponse } = pageContext;

		if (!httpResponse) {
			return next(); // Pass to next middleware if no response is generated
		} else {
			const { statusCode, headers, body } = httpResponse;
			headers.forEach(([name, value]) => res.setHeader(name, value));
			res.status(statusCode).send(body);
		}
	});

	// Start the server
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
}

startServer();
