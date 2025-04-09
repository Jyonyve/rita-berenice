// scripts/build-server.js
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Assumes scripts folder is one level down from root

// List all packages that should NOT be bundled
// Includes:
// - Native Node addons (.node files): onnxruntime-node, sharp, chromadb (often uses native parts)
// - Common server frameworks/middleware: express, compression
// - Dev/build tools if imported in server.ts (less common for prod build): vite, sirv (if only used for dev static serving)
// - Add any other packages that cause .node errors or are better left external
const externalPackages = [
	'express',
	'compression',
	'sirv', // Keep external if it's dynamically required or expected at runtime
	'vite', // Keep external if your server code somehow imports Vite itself (unlikely for production bundle)
	'onnxruntime-node',
	'sharp',
	'chromadb',
	// Add other native dependencies or large packages here if needed
];

console.log('🚀 Starting esbuild server build...');

try {
	await esbuild.build({
		entryPoints: [path.resolve(projectRoot, 'server.ts')], // Use absolute path for entry point
		outfile: path.resolve(projectRoot, 'dist/server.js'), // Use absolute path for output
		bundle: true,
		platform: 'node',
		format: 'esm', // Matches your project's "type": "module"
		external: externalPackages,
		logLevel: 'info', // Show warnings and errors
		sourcemap: true, // Generate sourcemaps for easier debugging
		// You might add 'minify: true' for production builds later
		// minify: process.env.NODE_ENV === 'production',
	});
	console.log('✅ Server build successful: dist/server.js');
} catch (error) {
	console.error('❌ Server build failed:');
	// esbuild errors often don't have a stack trace, so the error object itself is informative
	// console.error(error); // Uncomment if the default logging isn't enough
	process.exit(1); // Exit with error code
}
