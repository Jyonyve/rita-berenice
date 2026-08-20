// vite.config.ts (root)
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nodeBuiltinModules = builtinModules.map((m) => `node:${m}`);
const allBuiltinModules = [...new Set([...builtinModules, ...nodeBuiltinModules])];

export default defineConfig(({ mode, isSsrBuild }) => {
	const isStaticBuild = mode === 'static';
	const isProduction = mode === 'production';
	const rootDir = path.resolve(__dirname, '../../');
	const env = loadEnv(mode, rootDir, '');

	return {
		base: isStaticBuild ? '/rita-berenice/' : '/',
		cacheDir: '../../.vite_cache',
		envDir: rootDir,
		publicDir: '../../public',
		ssr: {
			// `@emotion/server` is a Node-side library (html-tokenize -> readable-stream). Bundling it
			// into the SSR output drags CommonJS Node internals in and breaks the bundle at import time,
			// so it stays external while the browser-facing emotion/MUI packages keep being inlined.
			external: [...allBuiltinModules, '@emotion/server', '@emotion/server/create-instance'],
			noExternal: [/^@mui\//, /^@emotion\/(?!server)/, 'react-router'],
			target: 'node',
		},

		plugins: [
			react({ jsxImportSource: '@emotion/react', babel: { plugins: ['@emotion/babel-plugin'] } }),
			// Browser polyfills for Node builtins must never be injected into the SSR bundle: they would
			// shadow the real `util`/`buffer`/`stream` that server-side dependencies rely on.
			...(isSsrBuild ? [] : [nodePolyfills({ protocolImports: true })]),
			tsconfigPaths({ root: '../../' }),
			svgr(),
		],

		define: {
			'import.meta.env.VITE_API_DOMAIN': JSON.stringify(
				env.VITE_API_DOMAIN || 'http://localhost:3000'
			),
			'import.meta.env.VITE_APP_DOMAIN': JSON.stringify(
				env.VITE_APP_DOMAIN || 'http://localhost:3000'
			),
			'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV || mode),
		},

		server: {
			host: '0.0.0.0',
			port: 3000,
			strictPort: false,
			open: true,
			watch: { ignored: ['**/public/assets/character/**'] },
		},
		preview: { host: '0.0.0.0', port: 3000, strictPort: false },

		build: {
			outDir: '../../dist/client',
			emptyOutDir: true,
			target: 'baseline-widely-available',
			// target: 'es2022',
			sourcemap: !isProduction,
			minify: 'esbuild',
			chunkSizeWarningLimit: 5000,

			rollupOptions: {
				// The HTML entry and the vendor-chunk split below describe the browser bundle only.
				// Vite supplies its own entry for `--ssr`, and manual chunking there produces circular
				// vendor chunks that break CommonJS interop (react-is) at import time.
				input: isSsrBuild ? undefined : path.resolve(__dirname, 'index.html'),
				output: {
					manualChunks: isSsrBuild
						? undefined
						: (id: string) => {
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
									return 'vendor';
								}
								return undefined;
							},
					chunkFileNames: (chunkInfo) => {
						const facadeModuleId = chunkInfo.facadeModuleId
							? chunkInfo.facadeModuleId.split('/').pop()
							: 'chunk';
						return `js/${facadeModuleId}-[hash].js`;
					},
				},
			},
			reportCompressedSize: false,
			write: true,
		},

		esbuild: { target: 'es2022', logOverride: { 'this-is-undefined-in-esm': 'silent' } },

		resolve: {
			alias: { '@rita-berenice/shared': path.resolve(__dirname, '../shared') },
			dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@emotion/cache'],
		},
	};
});
