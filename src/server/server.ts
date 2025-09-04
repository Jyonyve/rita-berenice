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
import cors from 'cors';
import sirv from 'sirv';
import { MODULE_NAMES, APPNAME } from '#shared/config/constants.js';
import characterRoutes from './route/character.routes.js';
import chatRoutes from './route/chat.routes.js';
import llmRoutes from './route/llm.routes.js';
import profileRoutes from './route/profile.routes.js';
import tempRoutes from './route/temp.routes.js';
import loreRoutes from './route/lore.routes.js';
import termRoutes from './route/term.routes.js';
import personaRoutes from './route/persona.routes.js';
import orchestrationRoutes from './route/orchestration.routes.js';
import { ApiErrorResponse } from '#shared/api/ModuleResponse.js';
import sessionRoutes from './route/session.routes.js';
import { ApiError } from '#shared/domain/error/errors.js';
import { decryptValue } from '#shared/util/cryptoUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // src/server
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = process.env.HOST || '0.0.0.0';
const BASE = process.env.BASE || '/'; // Base path for the app
const API_PATH = 'api';
const AUTH_PATH = 'auth';
const BASE_API = `/${API_PATH}`;
const localhost = 'http://localhost:3000';

// --- Helper Function to Resolve Project Root ---
const resolve = (p: string) =>
	isProduction ? path.resolve(__dirname, '../..', p) : path.resolve(__dirname, p);

// --- Template HTML paths ---
const templateDevHtmlFile = path.resolve(__dirname, '../../index.html');
const templateProdHtmlBuilt = path.resolve(__dirname, '../client/index.html');
const SUPERTOKENS_DOMAIN = process.env.SUPERTOKENS_DOMAIN;
const DECRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY;
if (!DECRYPTION_KEY) throw new Error('SECRET_ENCRYPTION_KEY is required.');

async function createServer() {
	if (!SUPERTOKENS_DOMAIN) {
		throw new Error('invalid supertokens login domain');
	}

	const app = express();

	supertokens.init({
		framework: 'express',
		supertokens: { connectionURI: SUPERTOKENS_DOMAIN, apiKey: process.env.SUPERTOKENS_API_KEY },
		appInfo: {
			appName: APPNAME,
			websiteDomain: process.env.VITE_APP_DOMAIN || '',
			apiDomain: process.env.VITE_API_DOMAIN || localhost,
			apiBasePath: `/${API_PATH}/${AUTH_PATH}`,
			websiteBasePath: `/${AUTH_PATH}`,
		},
		recipeList: [
			EmailPassword.init({
				override: {
					apis: (originalImplementation) => ({
						...originalImplementation,
						signInPOST: async function (input) {
							const passwordField = input.formFields.find((f) => f.id === 'password');

							// Check if the password field exists AND its value is a string
							if (passwordField && typeof passwordField.value === 'string' && DECRYPTION_KEY) {
								try {
									// Now TypeScript knows passwordField.value is a string, so this is safe
									const decryptedPassword = await decryptValue(passwordField.value, DECRYPTION_KEY);

									const updatedFormFields = input.formFields.map((f) =>
										f.id === 'password' ? { ...f, value: decryptedPassword } : f
									);

									return originalImplementation.signInPOST!({ ...input, formFields: updatedFormFields });
								} catch (err) {
									console.error('Server-side password decryption failed:', err);
									return {
										status: 'GENERAL_ERROR',
										message: 'Internal security error occurred. Please try again.',
									};
								}
							}

							// If the password field is missing or not a string, return an error
							console.error('Password field is missing or is not a string.');
							return { status: 'GENERAL_ERROR', message: 'Invalid request. Please check your inputs.' };
						},
					}),
				},
			}),
			Session.init(),
		],
	});

	app.use(
		cors({
			origin: process.env.VITE_APP_DOMAIN || localhost,
			allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
			credentials: true,
		})
	);
	// --- Core Middleware ---
	app.use(middleware());
	app.use(compression()); // Apply gzip compression
	app.use(express.json()); // Parse JSON request bodies

	// --- Language detection middleware (Korean-priority) ---
	// --- Language detection middleware (Korean-priority) ---
	const detectLanguageMiddleware = (req: Request, res: Response, next: NextFunction) => {
		let detectedLang: 'kor' | 'eng' = 'eng';

		// Priority 1: Use Express's built-in acceptsLanguages method (most reliable)
		const acceptedLang = req.acceptsLanguages('ko', 'en') || 'en';

		if (acceptedLang === 'ko') {
			detectedLang = 'kor';
		}

		// Priority 2: Manual header check as fallback
		if (detectedLang !== 'kor') {
			const acceptLang = req.headers['accept-language'] || '';

			if (acceptLang.toLowerCase().includes('ko')) {
				detectedLang = 'kor';
			}
		}

		// Priority 3: Check Cloudflare country header
		if (detectedLang !== 'kor') {
			const cfCountry = req.headers['cf-ipcountry'] as string;
			if (cfCountry === 'KR') {
				detectedLang = 'kor';
			}
		}

		res.locals.detectedLang = detectedLang;
		res.cookie('server-detected-lang', detectedLang, {
			maxAge: 24 * 60 * 60 * 1000,
			httpOnly: false,
		});

		next();
	};

	app.use(detectLanguageMiddleware);

	app.use(detectLanguageMiddleware);

	// --- Vite Development Server Middleware (Development ONLY) ---
	let vite: ViteDevServer | undefined;
	if (!isProduction) {
		vite = await createViteServer({
			server: {
				middlewareMode: true,
				// Add performance optimizations
				hmr: { port: 3001 },
			},
			appType: 'custom',
			base: BASE,
			root: path.resolve(__dirname, '../..'),
			// Add SSR optimizations
			optimizeDeps: {
				// Pre-bundle during server start for SSR
				force: true,
			},
			ssr: {
				// Optimize SSR deps
				noExternal: ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
			},
		});

		app.use(vite.middlewares);
		console.log('Vite development server middleware attached.');
	} else {
		// Production optimizations
		const serveOptions = {
			dev: false,
			immutable: true,
			maxAge: 31536000,
			// Add compression
			gzip: true,
			brotli: true,
		};
		app.use(BASE, sirv(resolve('dist/client'), serveOptions));
	}

	// --- API Routes ---
	console.log('Mounting API routes...');
	app.use(`${BASE_API}/${MODULE_NAMES.CHARACTER}`, characterRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.CHAT}`, chatRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.LLM}`, llmRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.PROFILE}`, profileRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.TEMP}`, tempRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.LORE}`, loreRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.TERM}`, termRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.SESSION}`, sessionRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.PERSONA}`, personaRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.ORCHESTRATION}`, orchestrationRoutes);
	app.use(errorHandler());

	// --- SSR Catch-all Handler ---
	app.get('/{*splat}', async (req: Request, res: Response, next: NextFunction) => {
		// Skip SSR for API routes
		if (req.originalUrl.startsWith(`${API_PATH}`) || req.originalUrl.startsWith(`${AUTH_PATH}`)) {
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

		try {
			let template: string;
			// Type for the render function from entry-server (adjust if render signature changes)
			let render: (url: string) => { html: string; emotionStyleTags: string };

			const detectedLang = res.locals.detectedLang || 'eng';

			if (!isProduction && vite) {
				// DEVELOPMENT
				template = await fs.readFile(templateDevHtmlFile, 'utf-8');
				template = await vite.transformIndexHtml(req.originalUrl, template);
				const serverEntry = await vite.ssrLoadModule('/src/entry-server.tsx');
				render = serverEntry.render;
			} else {
				// PRODUCTION
				template = await fs.readFile(templateProdHtmlBuilt, 'utf-8');
				const serverEntryPath = resolve('dist/server/entry-server.js');
				const serverEntry = await import(serverEntryPath);
				render = serverEntry.render;
			}

			// --- Render the React application ---
			// Call the render function from entry-server (NO Helmet context needed now)
			const { html: appHtml, emotionStyleTags } = render(req.originalUrl);

			// 🎯 INJECT LANGUAGE DATA VIA HTML TEMPLATE
			const finalHtml = template
				.replace(`<!--app-html-->`, appHtml)
				.replace(`<!--emotion-styles-->`, emotionStyleTags)
				.replace(`<!--server-data-->`, `<script>window.__INITIAL_LANG__="${detectedLang}"</script>`);

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

	app.listen(PORT, host, () => {
		console.log(`Server started successfully.`);
		console.log(`Mode: ${isProduction ? 'Production' : 'Development'}`);
		console.log(`Listening on http://${host}:${PORT}${BASE}`);
	});
}

// --- Initialize Server ---
createServer().catch((err) => {
	console.error('Fatal error during server startup:', err);
	process.exit(1);
});
