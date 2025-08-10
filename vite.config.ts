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
	const isProduction = mode === 'production';
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
			nodePolyfills({ protocolImports: true }),
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
		},

		// Keep preview config as is
		preview: { host: '0.0.0.0', port: 3000, strictPort: true },
		build: {
			target: 'es2022',
			sourcemap: !isProduction,
			minify: 'esbuild',
			chunkSizeWarningLimit: 1500, // Increase limit
			rollupOptions: {
				input: { main: './index.html', server: './src/entry-server.tsx' },
				output: {
					// Optimize chunk splitting for better performance
					manualChunks(id) {
						if (id.includes('node_modules')) {
							if (id.includes('@mui') || id.includes('@emotion')) {
								return 'vendor-mui';
							}
							if (id.includes('react')) {
								return 'vendor-react';
							}
							if (id.includes('supertokens')) {
								return 'vendor-auth';
							}
							if (id.includes('langchain')) {
								return 'vendor-langchain';
							}
							// All other node_modules into a generic vendor chunk
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
		esbuild: { target: 'es2022', logOverride: { 'this-is-undefined-in-esm': 'silent' } },
	};
});
