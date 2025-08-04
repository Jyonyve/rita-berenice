import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // Use import.meta.url for ES modules
import { builtinModules } from 'node:module'; // Correct import for ES modules
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// Helper to get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMADB = 'chromadb' as const;
const nodeBuiltinModules = builtinModules.map((m) => `node:${m}`);
const allBuiltinModules = [...new Set([...builtinModules, ...nodeBuiltinModules])];

export default defineConfig(({ mode }) => {
	// Conditionally set the base path.
	// For 'build' (GitHub Pages), set it to your repository name.
	// For 'serve' (local dev), it remains at the root '/'.
	const isStaticBuild = mode === 'static';

	return {
		root: '.',
		base: isStaticBuild ? '/rita-berenice/' : '/',
		cacheDir: '.vite_cache',
		define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV) },
		// SSR specific options
		ssr: {
			external: [CHROMADB, ...allBuiltinModules, 'fsevents'],
			noExternal: [
				'@mui/material',
				'@mui/system',
				'@mui/icons-material',
				'@emotion/react',
				'@emotion/styled',
				'@emotion/cache',
				'@emotion/server',
				'react-router',
				// Review Langchain if issues arise
			],
			target: 'node',
		},
		plugins: [
			react({ jsxImportSource: '@emotion/react', babel: { plugins: ['@emotion/babel-plugin'] } }),
			// Configure nodePolyfills to exclude 'crypto'
			tsconfigPaths(),
			svgr(),
		],
		build: {
			target: 'es2022',
			chunkSizeWarningLimit: 1000,
			rollupOptions: {
				input: {
					main: './index.html', // Client entry
					server: './src/entry-server.tsx', // Server entry - THIS WAS MISSING
				},
				external: [
					CHROMADB,
					'ollama',
					...allBuiltinModules,
					'fsevents',
					/^node:.*/,
					/^@chroma-core\/.*/,
				],
				output: {
					manualChunks(id) {
						if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
							return 'react-vendor';
						if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/'))
							return 'mui-vendor';
						if (id.includes('node_modules/onnxruntime-web')) return 'transformers'; // Keep if needed
						if (id.includes('@langchain/')) return 'langchain'; // Keep if needed
					},
				},
			},
			sourcemap: true, // Enable source maps for easier debugging
		},
		optimizeDeps: {
			include: ['@emotion/react', '@emotion/styled', '@emotion/cache'],
			exclude: [
				CHROMADB,
				'ollama',
				'whatwg-fetch', // Keep native deps excluded
				// Ensure sirv is NOT excluded if used in server.ts
			],
		},
		esbuild: {
			logOverride: { 'this-is-undefined-in-esm': 'silent', 'commonjs-variable-in-esm': 'silent' },
			logLevel: 'error',
			target: 'es2020',
		},
	};
});
