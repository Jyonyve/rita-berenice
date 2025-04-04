import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDevMiddleware, renderPage } from 'vike/server'; // Assuming renderPage is available

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function createServer() {
	const app = express();

	// --- Middleware ---
	// Add JSON body parser for API requests
	app.use(express.json());

	// --- Vike Dev Middleware (Non-Production) ---
	let viteDevMiddleware;
	if (!isProduction) {
		const root = __dirname; // Assuming server.js is at the project root
		const { devMiddleware } = await createDevMiddleware({ root });
		viteDevMiddleware = devMiddleware; // Store for later use in SSR
		app.use(viteDevMiddleware);
	}

	// --- API Routes ---
	// Define API routes BEFORE the Vike middleware

	// Character API Routes
	const characterRouter = express.Router();
	characterRouter.get('/', async (req, res) => {
		try {
			const characters = await chromaService.getCharacters();
			res.json(characters);
		} catch (error) {
			console.error('API Error GET /api/characters:', error);
			res.status(500).json({ error: 'Failed to fetch characters' });
		}
	});
	characterRouter.post('/', async (req, res) => {
		try {
			const newCharacter = req.body; // Assuming body is CharacterInfo
			if (!newCharacter || !newCharacter.id || !newCharacter.metadata) {
				return res.status(400).json({ error: 'Invalid character data in request body' });
			}
			await chromaService.addCharacter(newCharacter);
			res.status(201).json({ message: 'Character created successfully' });
		} catch (error) {
			console.error('API Error POST /api/characters:', error);
			res.status(500).json({ error: 'Failed to create character' });
		}
	});
	app.use('/api/characters', characterRouter);

	// Chroma Chat API Routes (aligning with useChromaChat)
	const chromaRouter = express.Router();

	// POST /api/chroma/store-turn
	chromaRouter.post('/store-turn', async (req, res) => {
		const { sessionId, chatTurn, embeddingModel } = req.body;
		if (!sessionId || !chatTurn) {
			return res.status(400).json({ error: 'Missing sessionId or chatTurn in request body' });
		}
		try {
			await chromaService.addChatTurn(sessionId, chatTurn, embeddingModel);
			res.status(201).json({ message: 'Chat turn added successfully' });
		} catch (error) {
			console.error(`API Error POST /api/chroma/store-turn (Session: ${sessionId}):`, error);
			res.status(500).json({ error: 'Failed to add chat turn' });
		}
	});

	// POST /api/chroma/store-summary
	chromaRouter.post('/store-summary', async (req, res) => {
		// Client sends 'newSummary', service expects 'summary'
		const { sessionId, newSummary, embeddingModel } = req.body;
		if (!sessionId || typeof newSummary !== 'string') {
			return res
				.status(400)
				.json({ error: 'Missing sessionId or invalid newSummary in request body' });
		}
		try {
			// Pass newSummary as the summary argument to the service
			await chromaService.addSummary(sessionId, newSummary, embeddingModel);
			res.status(201).json({ message: 'Summary added/updated successfully' });
		} catch (error) {
			console.error(`API Error POST /api/chroma/store-summary (Session: ${sessionId}):`, error);
			res.status(500).json({ error: 'Failed to add/update summary' });
		}
	});

	// GET /api/chroma/summary
	chromaRouter.get('/summary', async (req, res) => {
		const sessionId = req.query.sessionId; // Get from query param (remove 'as string')
		const embeddingModel = req.query.embeddingModel; // Remove 'as string | undefined'
		if (!sessionId) {
			return res.status(400).json({ error: 'Missing sessionId query parameter' });
		}
		try {
			const summary = await chromaService.getSummary(sessionId, embeddingModel);
			// Client expects string directly, not { summary: string }
			if (summary !== null) {
				res.type('text/plain').send(summary); // Send as plain text
			} else {
				res.status(404).send(''); // Send empty string for not found
			}
		} catch (error) {
			console.error(`API Error GET /api/chroma/summary (Session: ${sessionId}):`, error);
			res.status(500).json({ error: 'Failed to get summary' });
		}
	});

	// GET /api/chroma/query-log
	chromaRouter.get('/query-log', async (req, res) => {
		const sessionId = req.query.sessionId; // Remove 'as string'
		const query = req.query.query; // Client sends 'query' (remove 'as string')
		const limit = parseInt(req.query.limit || '10', 10); // Remove 'as string'
		const embeddingModel = req.query.embeddingModel; // Remove 'as string | undefined'

		if (!sessionId || !query) {
			return res.status(400).json({ error: 'Missing sessionId or query query parameter' });
		}

		try {
			const documents = await chromaService.queryChatLog(sessionId, query, limit, embeddingModel);
			res.json(documents); // Send documents array
		} catch (error) {
			console.error(`API Error GET /api/chroma/query-log (Session: ${sessionId}):`, error);
			res.status(500).json({ error: 'Failed to query chat log' });
		}
	});

	// GET /api/chroma/query-summary (New endpoint based on client hook)
	chromaRouter.get('/query-summary', async (req, res) => {
		const sessionId = req.query.sessionId; // Remove 'as string'
		const query = req.query.query; // Remove 'as string'
		const embeddingModel = req.query.embeddingModel; // Remove 'as string | undefined'

		if (!sessionId || !query) {
			return res.status(400).json({ error: 'Missing sessionId or query query parameter' });
		}

		try {
			// This might need refinement in chromaService: how to query *based on* the summary?
			// For now, let's assume it just returns the summary document if the query matches something in it.
			// A more robust implementation might involve querying turns *and* the summary.
			// Let's just return the summary content for simplicity, similar to getSummary.
			const summaryContent = await chromaService.getSummary(sessionId, embeddingModel);
			// Return as an array, similar to queryChatLog, even if it's just one item or empty
			res.json(summaryContent ? [summaryContent] : []);
		} catch (error) {
			console.error(`API Error GET /api/chroma/query-summary (Session: ${sessionId}):`, error);
			res.status(500).json({ error: 'Failed to query summary content' });
		}
	});

	app.use('/api/chroma', chromaRouter);

	// --- Vike SSR Middleware (Catch-all) ---
	// This should come AFTER specific API routes
	if (isProduction) {
		// In production, serve static files using express.static
		app.use(express.static(path.join(__dirname, 'dist/client')));
	}
	// This handles all other requests (SSR or client-side routing fallback)
	app.get('*', async (req, res, next) => {
		// Skip API routes if they somehow reach here (shouldn't happen with correct order)
		if (req.originalUrl.startsWith('/api/')) {
			return next();
		}

		const url = req.originalUrl;
		try {
			// Vike's renderPage function handles SSR
			const pageContextInit = { urlOriginal: req.originalUrl };
			const pageContext = await renderPage(pageContextInit); // Assuming renderPage is correctly set up by Vike

			if (pageContext.httpResponse === null) return next(); // Vike didn't handle the request

			const { body, statusCode, headers, earlyHints } = pageContext.httpResponse;
			res.writeEarlyHints?.({ link: earlyHints.map((e) => e.earlyHintLink) });
			headers.forEach(([name, value]) => res.setHeader(name, value));
			res.status(statusCode).send(body);
		} catch (e) {
			// Error handling for SSR
			viteDevMiddleware?.ssrFixStacktrace(e); // Fix stack trace in dev
			console.error('SSR Error:', e);
			// Optionally render an error page or send a generic error response
			res.status(500).send('Internal Server Error');
			// next(e); // Pass to default Express error handler if needed
		}
	});

	// --- Start Server ---

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}
createServer();
