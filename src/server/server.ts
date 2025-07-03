// src/server/server.ts

import path from 'node:path';
import fs from 'node:fs/promises'; // Use promises for async file reading
import { fileURLToPath } from 'node:url';
import express, {
	type Request,
	type Response,
	type NextFunction,
	type RequestHandler,
} from 'express';
import compression from 'compression'; // Add compression middleware
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import cors from 'cors';
import sirv from 'sirv';
import { MODULE_NAMES } from '#shared/config/constants.js';
import characterRoutes from './route/character.routes.js';
import chatRoutes from './route/chat.routes.js';
import llmRoutes from './route/llm.routes.js';
import profileRoutes from './route/profile.routes.js';
import tempRoutes from './route/temp.routes.js';
import loreRoutes from './route/lore.routes.js';
import termRoutes from './route/term.routes.js';
import memoryRoutes from './route/memory.routes.js';
import personaRoutes from './route/persona.routes.js';
import orchestrationRoutes from './route/orchestration.routes.js';
import { ApiErrorResponse } from '#shared/api/ModuleResponse.js';
import { ApiError } from './util/serviceHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // src/server
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const BASE = process.env.BASE || '/'; // Base path for the app
const BASE_API = `${BASE}api/`;
const AUTH_PATH = 'auth';

// --- Helper Function to Resolve Project Root ---
const resolve = (p: string) => path.resolve(__dirname, p);
function unless(middleware: RequestHandler, ...excludedPaths: RegExp[]): RequestHandler {
	return function (req, res, next) {
		if (excludedPaths.some((regex) => regex.test(req.path))) {
			return next();
		}
		return middleware(req, res, next);
	};
}

// --- Template HTML paths ---
const templateDevHtmlFile = path.resolve(__dirname, '../../index.html');
const templateProdHtmlBuilt = path.resolve(__dirname, '../client/index.html');
// --- SSR Manifest path (Production ONLY) ---
// Optional: for production preload hints, less critical for basic SSR
// const ssrManifestProd = resolve('dist/client/ssr-manifest.json');

async function createServer() {
	const app = express();

	supertokens.init({
		framework: 'express',
		supertokens: {
			connectionURI: process.env.VITE_SUPERTOKEN_DOMAIN || 'https://try.supertokens.com', // or your own core
			// apiKey: "<YOUR_API_KEY>", // if using your own core
		},
		appInfo: {
			appName: 'Rita-Berenice',
			websiteDomain: process.env.VITE_APP_DOMAIN || 'http://localhost:3000',
			apiDomain: process.env.VITE_API_DOMAIN || 'http://localhost:3000',
			apiBasePath: `${BASE_API}${AUTH_PATH}`,
			websiteBasePath: `/${AUTH_PATH}`,
		},
		recipeList: [EmailPassword.init(), Session.init()],
	});

	app.use(
		cors({
			origin: process.env.VITE_APP_DOMAIN || 'http://localhost:3000',
			allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
			credentials: true,
		})
	);
	// --- Core Middleware ---
	app.use(middleware());
	app.use(compression()); // Apply gzip compression
	app.use(express.json()); // Parse JSON request bodies

	// --- Vite Development Server Middleware (Development ONLY) ---
	let vite: ViteDevServer | undefined;
	if (!isProduction) {
		vite = await createViteServer({
			server: { middlewareMode: true },
			appType: 'custom',
			base: BASE,
			root: path.resolve(__dirname, '../..'), // root .
		});
		app.use(vite.middlewares);
		console.log('Vite development server middleware attached.');
	} else {
		// --- Production Static Asset Serving ---
		console.log(`Serving static files from ${resolve('dist/client')}`);
		app.use(BASE, sirv(resolve('dist/client'), { dev: false, immutable: true, maxAge: 31536000 }));
	}

	// --- API Routes ---
	console.log('Mounting API routes...');
	// Protect all /api/* routes except /api/character
	// app.use(
	// 	'/api',
	// 	unless(
	// 		verifySession(),
	// 		/^\/character/, // Exclude all /api/character routes
	// 		/^\/auth/ // Exclude /api/auth if you want public login/signup endpoints
	// 		// Add more patterns as needed
	// 	)
	// );
	app.use(`${BASE_API}${MODULE_NAMES.CHARACTER}`, characterRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.CHAT}`, chatRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.LLM}`, llmRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.PROFILE}`, profileRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.TEMP}`, tempRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.LORE}`, loreRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.TERM}`, termRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.MEMORY}`, memoryRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.PERSONA}`, personaRoutes);
	app.use(`${BASE_API}${MODULE_NAMES.ORCHESTRATION}`, orchestrationRoutes);
	app.use(errorHandler());

	// --- SSR Catch-all Handler ---
	app.get('/{*splat}', async (req: Request, res: Response, next: NextFunction) => {
		// Skip SSR for API routes
		if (req.originalUrl.startsWith(BASE_API)) {
			return next();
		}
		// Optional: Skip potential static files (basic check)
		const fileExtension = path.extname(req.originalUrl);
		if (
			[
				'.js',
				'.css',
				'.json',
				'.ico',
				'.png',
				'.jpg',
				'.jpeg',
				'.gif',
				'.svg',
				'.avif',
				'.webp',
				'.woff',
				'.woff2',
				'.map',
			].includes(fileExtension)
		) {
			return next();
		}

		console.log(`Attempting SSR for: ${req.originalUrl}`);
		const url = req.originalUrl;

		try {
			let template: string;
			// Type for the render function from entry-server (adjust if render signature changes)
			let render: (url: string) => { html: string; emotionStyleTags: string };

			if (!isProduction && vite) {
				// == DEVELOPMENT ==
				template = await fs.readFile(templateDevHtmlFile, 'utf-8');
				// Apply Vite HTML transforms (injects HMR client, plugins, etc.)
				template = await vite.transformIndexHtml(url, template);
				// Load server entry via Vite for HMR
				const serverEntry = await vite.ssrLoadModule('/src/entry-server.jsx');
				render = serverEntry.render;
			} else {
				// == PRODUCTION ==
				// In production, read the built index.html as it might contain link/script tags added by the build
				template = await fs.readFile(templateProdHtmlBuilt, 'utf-8');
				const serverEntryPath = resolve('dist/server/entry-server.js');
				const serverEntry = await import(serverEntryPath);
				render = serverEntry.render;
				// ssrManifest logic could be added here if needed for preloading
			}

			// --- Render the React application ---
			// Call the render function from entry-server (NO Helmet context needed now)
			const { html: appHtml, emotionStyleTags } = render(url); // Get HTML and Emotion styles

			// --- Inject rendered content into the HTML template ---
			// Replace placeholders with actual content
			const finalHtml = template
				.replace(`<!--app-html-->`, appHtml) // Inject main app HTML
				.replace(`<!--emotion-styles-->`, emotionStyleTags); // Inject extracted Emotion styles

			// --- Send the final HTML response ---
			res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
		} catch (e: any) {
			if (vite) {
				// Let Vite fix stack trace in dev
				vite.ssrFixStacktrace(e);
			}
			console.error(`SSR Error processing ${req.originalUrl}:`, e.stack || e);
			next(e); // Pass error to default handler
		}
	});

	// --- Route-level 404 handler (MUST be after all routes and SSR) ---
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.status(404).json({ status: 'error', code: 404, message: 'Route not found' });
	});

	// --- Default Express Error Handler ---
	app.use((err: Error | ApiError, req: Request, res: Response, next: NextFunction): void => {
		let apiErrorResponse: ApiErrorResponse;

		if (err instanceof ApiError) {
			apiErrorResponse = {
				status: 'error',
				code: err.status,
				message: err.clientMessage || err.message,
				details: err.details,
			};
			if (process.env.NODE_ENV === 'development' && !err.clientMessage) {
				apiErrorResponse.debug = err.message;
			}
		} else {
			console.error('Unhandled Server Error:', err.stack || err);
			apiErrorResponse = { status: 'error', code: 500, message: 'Internal Server Error' };
			if (process.env.NODE_ENV === 'development') {
				apiErrorResponse.debug = err.message;
			}
		}
		if (apiErrorResponse.details === undefined) {
			delete apiErrorResponse.details;
		}
		res.status(apiErrorResponse.code).json(apiErrorResponse);
	});

	// --- Start HTTP Server ---
	app.listen(PORT, () => {
		console.log(`Server started successfully.`);
		console.log(`Mode: ${isProduction ? 'Production' : 'Development'}`);
		console.log(`Listening on: http://localhost:${PORT}${BASE}`);
	});
}

// --- Initialize Server ---
createServer().catch((err) => {
	console.error('Fatal error during server startup:', err);
	process.exit(1);
});
