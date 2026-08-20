// src/server/server.ts

import path from 'node:path';
import fs from 'node:fs/promises'; // Use promises for async file reading
import { createServer as createHttpServer } from 'node:http';
import { createConnection, createServer as createTcpServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import compression from 'compression'; // Add compression middleware
import type { ViteDevServer } from 'vite';

import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Dashboard from 'supertokens-node/recipe/dashboard';
import UserRoles from 'supertokens-node/recipe/userroles';
import {
	middleware as supertokensMiddleware,
	errorHandler as supertokensErrorHandler,
} from 'supertokens-node/framework/express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

import cors from 'cors';
import sirv from 'sirv';
import { sql } from 'drizzle-orm';

import characterRoutes from './route/character.routes.js';
import chatRoutes from './route/chat.routes.js';
import llmRoutes from './route/llm.routes.js';
import profileRoutes from './route/profile.routes.js';
import tempRoutes from './route/temp.routes.js';
import loreRoutes from './route/lore.routes.js';
import termRoutes from './route/term.routes.js';
import personaRoutes from './route/persona.routes.js';
import orchestrationRoutes from './route/orchestration.routes.js';
import sessionRoutes from './route/session.routes.js';
import userRoutes from './route/user.routes.js';
import credentialRoutes from './route/credential.routes.js';
import historyRoutes from './route/history.routes.js';
import documentRoutes from './route/document.routes.js';
import { buildRitaAccessTokenPayload } from './service/authIdentityService.js';
import { provisionUserOnSignup } from './service/userProvisioningService.js';
import { finalizationJobService } from './service/finalizationJobService.js';
import { ApiErrorResponse } from '@rita-berenice/shared/api';
import { APPNAME, MODULE_NAMES } from '@rita-berenice/shared/config';
import { ApiError } from '@rita-berenice/shared/domain';
import { getServerEnv } from './config/env.js';
import { getDatabase } from './db/postgresClient.js';
import { flowLogger, serializeError } from './util/jsonlLogger.js';
import { apiRequestLogger, asyncHandler } from './util/routeHelpers.js';
import {
	ensureLocalImageStorageRoot,
	getImageAsset,
	isObjectImageStorageConfigured,
} from './util/imageStorageUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // src/server
const serverEnv = getServerEnv();
const isProduction = serverEnv.NODE_ENV === 'production';
const host = serverEnv.HOST;
const BASE = serverEnv.BASE; // Base path for the app
const API_PATH = 'api';
const AUTH_PATH = 'auth';
const BASE_API = `/${API_PATH}`;

// --- Helper Function to Resolve Project Root ---
const resolve = (p: string) =>
	isProduction ? path.resolve(process.cwd(), p) : path.resolve(__dirname, p);

// --- Template HTML paths ---
const templateDevHtmlFile = path.resolve(__dirname, '../client/index.html');
const templateProdHtmlBuilt = resolve('dist/client/index.html');
const dashboardAdmins = serverEnv.DASHBOARD_ADMIN_EMAILS;

const canBindPort = (port: number, listenHost: string): Promise<boolean> =>
	new Promise((resolve, reject) => {
		const probe = createTcpServer();

		probe.once('error', (error: NodeJS.ErrnoException) => {
			if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
				resolve(false);
				return;
			}

			reject(error);
		});

		probe.once('listening', () => {
			probe.close(() => resolve(true));
		});

		probe.listen(port, listenHost);
	});

const canConnectPort = (port: number, connectHost: string): Promise<boolean> =>
	new Promise((resolve) => {
		const probe = createConnection({ port, host: connectHost });
		const cleanup = () => {
			probe.removeAllListeners();
			probe.destroy();
		};

		probe.setTimeout(300);
		probe.once('connect', () => {
			cleanup();
			resolve(true);
		});
		probe.once('timeout', () => {
			cleanup();
			resolve(false);
		});
		probe.once('error', () => {
			cleanup();
			resolve(false);
		});
	});

const isLocalPortOccupied = async (port: number) =>
	(await canConnectPort(port, '127.0.0.1')) || (await canConnectPort(port, '::1'));

const findAvailablePort = async (preferredPort: number, listenHost: string) => {
	for (let port = preferredPort; port < preferredPort + 10; port += 1) {
		const canBind = await canBindPort(port, listenHost);
		const isOccupiedFromLocalhost = await isLocalPortOccupied(port);

		if (canBind && !isOccupiedFromLocalhost) {
			return port;
		}
	}

	throw new Error(`No available local port found from ${preferredPort} to ${preferredPort + 9}`);
};

const shouldUseLocalDevOrigin = (configuredOrigin: string | undefined, preferredPort: number) => {
	if (!configuredOrigin) {
		return true;
	}

	try {
		const url = new URL(configuredOrigin);
		const isLocalHost =
			url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
		const configuredPort = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;

		return isLocalHost && configuredPort === preferredPort;
	} catch {
		return false;
	}
};

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
	const preferredPort = serverEnv.PORT;
	const port = isProduction ? preferredPort : await findAvailablePort(preferredPort, host);
	const localOrigin = `http://localhost:${port}`;
	const appDomain =
		!isProduction && shouldUseLocalDevOrigin(serverEnv.VITE_APP_DOMAIN, preferredPort)
			? localOrigin
			: serverEnv.VITE_APP_DOMAIN || localOrigin;
	const apiDomain =
		!isProduction && shouldUseLocalDevOrigin(serverEnv.VITE_API_DOMAIN, preferredPort)
			? localOrigin
			: serverEnv.VITE_API_DOMAIN || localOrigin;

	if (isProduction && !isObjectImageStorageConfigured()) {
		throw new Error(
			'Production requires private object image storage; configure BUCKET_NAME and its S3 credentials'
		);
	}

	if (!isProduction) {
		process.env.VITE_APP_DOMAIN = appDomain;
		process.env.VITE_API_DOMAIN = apiDomain;
	}

	const app = express();
	const httpServer = createHttpServer(app);

	supertokens.init({
		framework: 'express',
		supertokens: {
			connectionURI: serverEnv.SUPERTOKENS_CONNECTION_URI,
			apiKey: serverEnv.SUPERTOKENS_API_KEY,
		},
		appInfo: {
			appName: APPNAME,
			websiteDomain: appDomain,
			apiDomain,
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
						signUpPOST: async (input) => {
							if (!originalImplementation.signUpPOST) {
								throw new Error('signUpPOST is not available');
							}
							const response = await originalImplementation.signUpPOST(input);
							if (response.status === 'OK' && serverEnv.AUTO_PROVISION_USERS) {
								await provisionUserOnSignup(response.user.id, response.user.emails[0]);
							}
							return response;
						},
					}),
				},
			}),
			Session.init({
				override: {
					functions: (originalImplementation) => ({
						...originalImplementation,
						createNewSession: async (input) => {
							return originalImplementation.createNewSession({
								...input,
								accessTokenPayload: await buildRitaAccessTokenPayload(
									input.userId,
									input.accessTokenPayload
								),
							});
						},
					}),
				},
			}),
		],
	});

	// --- Core Middleware (Order is important) ---
	app.use(
		cors({
			origin: appDomain,
			allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
			credentials: true,
		})
	);

	app.get('/healthz', (req: Request, res: Response) => {
		res.status(200).json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
	});

	app.get('/readyz', async (req: Request, res: Response) => {
		try {
			await getDatabase().execute(sql`select 1`);
			res.status(200).json({ status: 'ready' });
		} catch (error) {
			flowLogger.warn('server', 'readiness.failed', serializeError(error));
			res.status(503).json({ status: 'not_ready' });
		}
	});

	// --- Dashboard Headers Middleware ---
	// app.use((req, res, next) => {
	// 	if (req.path.includes('/dashboard')) {
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
	// 				process.env.SUPERTOKENS_CONNECTION_URI +
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
	const runtimeImagePrefixes = ['/assets/character', '/assets/profile', '/assets/user'] as const;
	for (const runtimePrefix of runtimeImagePrefixes) {
		if (isObjectImageStorageConfigured()) {
			app.use(
				runtimePrefix,
				verifySession(),
				asyncHandler(async (req: Request, res: Response): Promise<void> => {
					const decodedPath = req.path
						.split('/')
						.map((segment) => decodeURIComponent(segment))
						.join('/');
					const asset = await getImageAsset(`${runtimePrefix}${decodedPath}`);
					if (!asset) {
						res.status(404).end();
						return;
					}

					res.setHeader('Content-Type', asset.contentType);
					res.setHeader('Cache-Control', 'private, no-cache');
					if (asset.etag) {
						res.setHeader('ETag', asset.etag);
						if (req.headers['if-none-match'] === asset.etag) {
							res.status(304).end();
							return;
						}
					}
					res.status(200).send(asset.body);
				})
			);
		} else {
			app.use(
				runtimePrefix,
				verifySession(),
				express.static(
					path.join(ensureLocalImageStorageRoot(), runtimePrefix.slice('/assets/'.length)),
					{ fallthrough: false, maxAge: 0 }
				)
			);
		}
	}

	if (!isProduction) {
		const { createServer: createViteServer } = await import('vite');
		vite = await createViteServer({
			cacheDir: path.resolve(__dirname, '../../.vite_cache/ssr-host'),
			server: { middlewareMode: true, hmr: { server: httpServer } },
			appType: 'custom',
			base: BASE,
			root: path.resolve(__dirname, '../client'),
			ssr: {
				// Optimize SSR deps
				noExternal: ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
			},
		});

		app.use(vite.middlewares);
		flowLogger.info('server', 'vite.middleware.attached');
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
		// `dist/client/index.html` is the SSR *template*, not a servable page: it still contains the
		// <!--app-html--> / <!--emotion-styles--> / <!--server-data--> placeholders. sirv answers a bare
		// directory request with that file, which would bypass the SSR handler below and ship an empty
		// #root to the browser (React then fails hydration with error #418). Let the document requests
		// fall through to SSR and keep sirv for real static assets only.
		const serveStaticAssets = sirv(resolve('dist/client'), serveOptions);
		app.use(BASE, (req: Request, res: Response, next: NextFunction) => {
			if (req.path === '/' || req.path === '/index.html') {
				return next();
			}
			return serveStaticAssets(req, res, next);
		});
	}

	// --- API Routes ---
	flowLogger.info('server', 'apiRoutes.mount.start');
	app.use(BASE_API, apiRequestLogger);
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
	app.use(`${BASE_API}/${MODULE_NAMES.USER}`, userRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.CREDENTIAL}`, credentialRoutes);
	app.use(`${BASE_API}/${MODULE_NAMES.DOCUMENT}`, documentRoutes);

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
				.replace(`<!--app-html-->`, '')
				.replace(`<!--emotion-styles-->`, '')
				.replace(`<!--server-data-->`, `<script>window.__INITIAL_LANG__="${detectedLang}"</script>`);

			res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
		} catch (error) {
			flowLogger.error('server', 'authRoute.render.failed', {
				path: req.originalUrl,
				...serializeError(error),
			});
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

		flowLogger.info('server', 'ssr.render.start', { path: req.originalUrl });

		try {
			let template: string;
			// Type for the render function from entry-server (adjust if render signature changes)
			let render: (
				url: string,
				initialLang?: 'kor' | 'eng'
			) => { html: string; emotionStyleTags: string };

			const detectedLang = res.locals.detectedLang || 'eng';

			if (!isProduction && vite) {
				// DEVELOPMENT
				template = await fs.readFile(templateDevHtmlFile, 'utf-8');
				template = await vite.transformIndexHtml(req.originalUrl, template);
				const serverEntry = await vite.ssrLoadModule('/entry-server.tsx');
				render = serverEntry.render;
			} else {
				// PRODUCTION
				template = await fs.readFile(templateProdHtmlBuilt, 'utf-8');
				const serverEntryPath = resolve('packages/client/dist/ssr/entry-server.js');
				const serverEntry = await import(serverEntryPath);
				render = serverEntry.render;
			}

			// --- Render the React application ---
			// Call the render function from entry-server (NO Helmet context needed now)
			const { html: appHtml, emotionStyleTags } = render(req.originalUrl, detectedLang);

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
			flowLogger.error('server', 'ssr.render.failed', { path: req.originalUrl, ...serializeError(e) });
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
			if (serverEnv.NODE_ENV === 'development' && !err.clientMessage) {
				apiErrorResponse.debug = err.message;
			}
		} else {
			flowLogger.error('server', 'request.unhandledError', {
				path: req.originalUrl,
				method: req.method,
				...serializeError(err),
			});
			apiErrorResponse = { status: 'error', code: 500, message: 'Internal Server Error' };
			if (serverEnv.NODE_ENV === 'development') {
				apiErrorResponse.debug = err.message;
			}
		}
		if (apiErrorResponse.details === undefined) {
			delete apiErrorResponse.details;
		}
		res.status(apiErrorResponse.code).json(apiErrorResponse);
	});

	httpServer.listen(port, host, () => {
		if (!isProduction && port !== preferredPort) {
			console.info(`Port ${preferredPort} is busy; using ${port} instead.`);
		}
		console.info(`Local: ${localOrigin}`);

		flowLogger.info('server', 'startup.complete', {
			mode: isProduction ? 'production' : 'development',
			host,
			port,
			base: BASE,
		});
		void finalizationJobService
			.resumePendingJobs()
			.then((resumedCount) => {
				flowLogger.info('server', 'finalizationJobs.resume.complete', { resumedCount });
			})
			.catch((error) => {
				flowLogger.error('server', 'finalizationJobs.resume.failed', serializeError(error));
			});
	});

	let isShuttingDown = false;
	const shutdown = async (signal: NodeJS.Signals) => {
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;
		flowLogger.info('server', 'shutdown.start', { signal });

		await vite?.close();
		httpServer.close(() => process.exit(0));
	};

	process.once('SIGINT', () => void shutdown('SIGINT'));
	process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

// --- Initialize Server ---
createServer().catch((err) => {
	console.error('[server] startup failed:', err);
	flowLogger.error('server', 'startup.failed', serializeError(err));
	process.exit(1);
});
