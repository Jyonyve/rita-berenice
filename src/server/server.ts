// src/server/server.ts

import path from 'node:path';
import fs from 'node:fs/promises'; // Use promises for async file reading
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import compression from 'compression'; // Add compression middleware
import { createServer as createViteServer, type ViteDevServer } from 'vite';

import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Dashboard from 'supertokens-node/recipe/dashboard';
import UserRoles from 'supertokens-node/recipe/userroles';
import {
	middleware as supertokensMiddleware,
	errorHandler as supertokensErrorHandler,
} from 'supertokens-node/framework/express';

import cors from 'cors';
import sirv from 'sirv';

import { MODULE_NAMES, APPNAME, DEFAULT_TENANT_ID } from '#shared/config/constants.js';
import characterRoutes from './route/character.routes.js';
import chatRoutes from './route/chat.routes.js';
import llmRoutes from './route/llm.routes.js';
import profileRoutes from './route/profile.routes.js';
import tempRoutes from './route/temp.routes.js';
import loreRoutes from './route/lore.routes.js';
import termRoutes from './route/term.routes.js';
import personaRoutes from './route/persona.routes.js';
import orchestrationRoutes from './route/orchestration.routes.js';
import loginRoutes from './route/login.routes.js';
import sessionRoutes from './route/session.routes.js';
import userRoutes from './route/user.routes.js';
import credentialRoutes from './route/credential.routes.js';
import historyRoutes from './route/history.routes.js';
import { ApiErrorResponse } from '#shared/api/ModuleResponse.js';
import { ApiError } from '#shared/domain/error/errors.js';
import { userStore } from './store/userStore.js';
import { credentialStore } from './store/credentialStore.js';

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
const dashboardAdmins = process.env.DASHBOARD_ADMIN_EMAILS
	? process.env.DASHBOARD_ADMIN_EMAILS.split(',').map((email) => email.trim())
	: [];

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
	res.cookie('server-detected-lang', detectedLang, { maxAge: 24 * 60 * 60 * 1000, httpOnly: false });

	next();
};

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
			websiteDomain: process.env.VITE_APP_DOMAIN || localhost,
			apiDomain: process.env.VITE_API_DOMAIN || localhost,
			apiBasePath: `/${API_PATH}/${AUTH_PATH}`,
			websiteBasePath: `/${AUTH_PATH}`,
		},
		recipeList: [
			UserRoles.init(),
			Dashboard.init({ admins: dashboardAdmins }),
			EmailPassword.init({
				override: {
					apis: (originalImplementation) => ({
						...originalImplementation,
						signUpPOST: async function (input) {
							if (!originalImplementation.signUpPOST) {
								throw new Error('signUpPOST is not available');
							}
							const response = await originalImplementation.signUpPOST(input);

							if (response.status === 'OK') {
								try {
									await UserRoles.addRoleToUser('public', response.user.id, 'user');

									const userCdo = { userId: response.user.id, email: response.user.emails[0] };
									await userStore.storeUser(userCdo);
									await credentialStore.initializeDefaultApiKeys(response.user.id);

									console.log('✅ User successfully synced to database:', response.user.id);
								} catch (error) {
									console.error('❌ Failed to sync user to database:', error);
									// Consider whether to return an error or just log it
									// For now, we'll let the signup succeed even if DB sync fails
								}
							}

							return response;
						},
					}),
				},
			}),
			Session.init(),
		],
	});

	// --- Core Middleware (Order is important) ---
	app.use(
		cors({
			origin: process.env.VITE_APP_DOMAIN || localhost,
			allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
			credentials: true,
		})
	);

	// --- Dashboard Headers Middleware ---
	// app.use((req, res, next) => {
	// 	if (req.path.includes('/dashboard')) {
	// 		console.log('Setting headers for dashboard request:', req.path);
	// 		res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	// 		res.setHeader('Pragma', 'no-cache');
	// 		res.setHeader('Expires', '0');
	// 		res.setHeader(
	// 			'Content-Security-Policy',
	// 			"default-src 'self'; " +
	// 				"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " + // Added 'unsafe-eval'
	// 				"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
	// 				"font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
	// 				"img-src 'self' data: https://cdn.jsdelivr.net; " +
	// 				"connect-src 'self' " +
	// 				process.env.SUPERTOKENS_DOMAIN +
	// 				' https://fonts.googleapis.com https://fonts.gstatic.com'
	// 		);
	// 	}
	// 	next();
	// });

	app.use(supertokensMiddleware());
	app.use(compression());
	app.use(express.json());
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
	app.use(`${BASE_API}/${MODULE_NAMES.HISTORY}`, historyRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.TERM}`, termRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.SESSION}`, sessionRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.PERSONA}`, personaRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.ORCHESTRATION}`, orchestrationRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.LOGIN}`, loginRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.USER}`, userRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.CREDENTIAL}`, credentialRoutes);

	// ✅ CORRECT for Express v5 - matches /auth, /auth/reset-password, etc.
	app.get(`/${AUTH_PATH}{*splat}`, async (req: Request, res: Response) => {
		try {
			let template: string;

			if (!isProduction && vite) {
				template = await fs.readFile(templateDevHtmlFile, 'utf-8');
				template = await vite.transformIndexHtml(req.originalUrl, template);
			} else {
				template = await fs.readFile(templateProdHtmlBuilt, 'utf-8');
			}

			const detectedLang = res.locals.detectedLang || 'eng';

			const finalHtml = template
				.replace(`<!--app-html-->`, '<div id="root"></div>')
				.replace(`<!--emotion-styles-->`, '')
				.replace(`<!--server-data-->`, `<script>window.__INITIAL_LANG__="${detectedLang}"</script>`);

			res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
		} catch (error) {
			console.error('Error serving auth route:', error);
			res.status(500).send('Internal Server Error');
		}
	});

	// --- SSR Catch-all Handler ---
	app.get('/{*splat}', async (req: Request, res: Response, next: NextFunction) => {
		// Skip SSR for API routes
		if (req.originalUrl.startsWith(`${BASE_API}`) || req.originalUrl.startsWith(`/${AUTH_PATH}`)) {
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

	// --- SuperTokens Error Handler (should come after routes but before custom error handlers) ---
	app.use(supertokensErrorHandler());

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
