import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // <-- ADD THIS BACK
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// Helper constants remain the same
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHROMADB = 'chromadb' as const;
const nodeBuiltinModules = builtinModules.map((m) => `node:${m}`);
const allBuiltinModules = [...new Set([...builtinModules, ...nodeBuiltinModules])];

export default defineConfig(({ mode }) => {
	const isStaticBuild = mode === 'static';

	return {
		root: '.',
		base: isStaticBuild ? '/rita-berenice/' : '/',
		cacheDir: '.vite_cache',
		define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV) },

		// SSR specific options - This section is CORRECT and remains unchanged.
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
			],
			target: 'node',
		},

		plugins: [
			react({ jsxImportSource: '@emotion/react', babel: { plugins: ['@emotion/babel-plugin'] } }),

			// ADD THIS PLUGIN BACK. It is essential for fixing the client-side error.
			nodePolyfills(),

			tsconfigPaths(),
			svgr(),
		],

		build: {
			target: 'es2022',
			chunkSizeWarningLimit: 1000,
			rollupOptions: {
				input: { main: './index.html', server: './src/entry-server.tsx' },
				// THIS IS THE CRITICAL CHANGE:
				// We remove the server-specific externals from this general build section.
				// The `ssr.external` option already handles the server build correctly.
				// This allows the polyfill plugin to work on the client build.
				external: [
					'ollama', // Keep other server-only externals here if needed
					'fsevents',
				],
				output: {
					manualChunks(id) {
						if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
							return 'react-vendor';
						if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/'))
							return 'mui-vendor';
						if (id.includes('node_modules/onnxruntime-web')) return 'transformers';
						if (id.includes('@langchain/')) return 'langchain';
					},
				},
			},
			sourcemap: true,
		},

		// optimizeDeps and esbuild remain the same
		optimizeDeps: {
			include: ['@emotion/react', '@emotion/styled', '@emotion/cache'],
			exclude: [CHROMADB, 'ollama', 'whatwg-fetch'],
		},
		esbuild: {
			logOverride: { 'this-is-undefined-in-esm': 'silent', 'commonjs-variable-in-esm': 'silent' },
			logLevel: 'error',
			target: 'es2020',
		},
	};
});
