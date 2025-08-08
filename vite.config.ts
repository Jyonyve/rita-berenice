import { defineConfig, loadEnv } from 'vite';
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
	const env = loadEnv(mode, process.cwd(), '');
	return {
		root: '.',
		base: isStaticBuild ? '/rita-berenice/' : '/',
		cacheDir: '.vite_cache',

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
		define: {
			'import.meta.env.VITE_API_DOMAIN': JSON.stringify(
				env.VITE_API_DOMAIN || 'http://localhost:3000'
			),
		},

		// Fix server configuration to match your server.ts
		server: {
			host: '0.0.0.0', // Match your server.ts host setting
			port: 3000,
			strictPort: true,
			// Add performance optimizations
			hmr: {
				port: 3001, // Use separate port for HMR
			},
			// Optimize middleware mode for SSR
			middlewareMode: false,
		},

		// Keep preview config as is
		preview: { host: '0.0.0.0', port: 3000, strictPort: true },
		build: {
			target: 'es2022',
			chunkSizeWarningLimit: 1500, // Increase limit
			rollupOptions: {
				input: { main: './index.html', server: './src/entry-server.tsx' },
				external: [
					'ollama',
					'fsevents',
					'chromadb', // Add this for server build optimization
				],
				output: {
					// Optimize chunk splitting for better performance
					manualChunks(id) {
						// React ecosystem
						if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
							return 'react-vendor';
						}

						// MUI and Emotion (large bundle)
						if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) {
							return 'mui-vendor';
						}

						// SuperTokens (separate chunk)
						if (id.includes('supertokens')) {
							return 'auth-vendor';
						}

						// AI/ML libraries
						if (id.includes('onnxruntime') || id.includes('transformers')) {
							return 'ai-vendor';
						}

						// LangChain
						if (id.includes('@langchain/') || id.includes('langchain')) {
							return 'langchain-vendor';
						}

						// Other large vendor libraries
						if (id.includes('node_modules/')) {
							return 'vendor';
						}
					},
					// Add chunk optimization
					chunkFileNames: (chunkInfo) => {
						const facadeModuleId = chunkInfo.facadeModuleId
							? chunkInfo.facadeModuleId.split('/').pop()
							: 'chunk';
						return `js/${facadeModuleId}-[hash].js`;
					},
				},
			},
			sourcemap: process.env.NODE_ENV === 'development', // Only in dev
			minify: 'esbuild', // Faster than terser
			// Add build performance options
			reportCompressedSize: false, // Skip gzip size calculation
			write: true,
		},

		// optimizeDeps and esbuild remain the same
		optimizeDeps: {
			include: [
				'@emotion/react',
				'@emotion/styled',
				'@emotion/cache',
				'@mui/material',
				'@mui/system',
				'@mui/icons-material',
				'react',
				'react-dom',
				'react-router',
			],
			exclude: ['chromadb', 'ollama', 'whatwg-fetch', 'fsevents'],
			// Force optimize these deps
			force: true,
		},
		esbuild: {
			logOverride: { 'this-is-undefined-in-esm': 'silent', 'commonjs-variable-in-esm': 'silent' },
			logLevel: 'error',
			target: 'es2020',
		},
	};
});
