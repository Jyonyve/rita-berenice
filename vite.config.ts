import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // Use import.meta.url for ES modules
import { builtinModules } from 'node:module'; // Correct import for ES modules
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import topLevelAwaitPlugin, { Options } from 'vite-plugin-top-level-await';

// Helper to get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type assertion for the topLevelAwait plugin (keep if it fixed previous issues)
const topLevelAwait = topLevelAwaitPlugin as unknown as (options?: Options) => Plugin;

const CHROMADB = 'chromadb' as const;
const nodeBuiltinModules = builtinModules.map((m) => `node:${m}`);
const allBuiltinModules = [...new Set([...builtinModules, ...nodeBuiltinModules])];

export default defineConfig({
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
			// Review Langchain if issues arise
		],
		target: 'node',
	},
	resolve: {
		alias: {
			// Client-side aliases
			'@client': path.resolve(__dirname, './src/client'),
			'@client/domain': path.resolve(__dirname, './src/client/domain'), // Consider moving shared domain to @shared
			'@client/component': path.resolve(__dirname, './src/client/component'),
			'@client/hook': path.resolve(__dirname, './src/client/hook'),
			'@client/asset': path.resolve(__dirname, './src/client/asset'), // Or assets

			// Shared alias
			'@shared': path.resolve(__dirname, './src/shared'),

			// Server-side aliases (Using # prefix is fine, ensure consistency)
			// Adjusted to plural folder names
			'#server': path.resolve(__dirname, './src/server'),
			'#server/db': path.resolve(__dirname, './src/server/db'),
			'#server/routes': path.resolve(__dirname, './src/server/routes'),
			'#server/services': path.resolve(__dirname, './src/server/services'),

			// Root alias
			'#root': path.resolve(__dirname, '.'),

			// migration alias
			'#migration': path.resolve(__dirname, './src/migration'),
			'#migration/chat': path.resolve(__dirname, './src/migration/chat/*'),
			'#migration/character': path.resolve(__dirname, './src/migration/character/*'),
			'#migration/source': path.resolve(__dirname, './src/migration/source/*'),
		},
	},
	plugins: [
		react({ jsxImportSource: '@emotion/react', babel: { plugins: ['@emotion/babel-plugin'] } }),
		// Configure nodePolyfills to exclude 'crypto'
		nodePolyfills({
			exclude: ['crypto'],
			// Keep other options if needed
			globals: { Buffer: true, global: true, process: true },
			protocolImports: true,
		}),

		topLevelAwait(),
		tsconfigPaths(),
		svgr(),
	],
	build: {
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			external: [CHROMADB, ...allBuiltinModules, 'fsevents', /^node:.*/],
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
			CHROMADB, // Keep native deps excluded
			// Ensure sirv is NOT excluded if used in server.ts
		],
	},
	esbuild: {
		logOverride: { 'this-is-undefined-in-esm': 'silent', 'commonjs-variable-in-esm': 'silent' },
		logLevel: 'error',
		target: 'es2020',
	},
});
