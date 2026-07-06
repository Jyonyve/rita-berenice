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

export default defineConfig(({ mode }) => {
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
			external: allBuiltinModules,
			noExternal: [
				'@mui/material',
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
			nodePolyfills({ protocolImports: true }),
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
			'import.meta.env.VITE_SUPERTOKENS_DOMAIN': JSON.stringify(env.VITE_SUPERTOKENS_DOMAIN || ''),
			'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV || mode),
		},

		server: { host: '0.0.0.0', port: 3000, strictPort: true },
		preview: { host: '0.0.0.0', port: 3000, strictPort: true },

		build: {
			outDir: '../../dist/client',
			emptyOutDir: true,
			target: 'baseline-widely-available',
			// target: 'es2022',
			sourcemap: !isProduction,
			minify: 'esbuild',
			chunkSizeWarningLimit: 5000,

			rollupOptions: {
				input: path.resolve(__dirname, 'index.html'),
				output: {
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
							return 'vendor';
						}
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

		resolve: { alias: { '@rita-berenice/shared': path.resolve(__dirname, '../shared') } },
	};
});
