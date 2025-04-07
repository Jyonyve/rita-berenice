import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import vike from 'vike/plugin';
import { builtinModules } from 'module';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import topLevelAwaitPlugin from 'vite-plugin-top-level-await';

const topLevelAwait = topLevelAwaitPlugin as unknown as (options?: any) => Plugin;

const CHROMADB = 'chromadb' as const;
const nodeBuiltinModules = builtinModules.map((m) => `node:${m}`);

export default defineConfig({
	define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV), global: 'globalThis' },
	ssr: {
		external: [CHROMADB, ...builtinModules, 'fsevents', ...nodeBuiltinModules],
		noExternal: [
			'@mui/material',
			'@mui/styled-engine',
			'@emotion/react',
			'@emotion/styled',
			'@emotion/cache',
			'@emotion/server',
			'@emotion/utils',
			'@langchain/community',
		],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src/client'),
			'@server/api': path.resolve(__dirname, './src/server/api'),
			'@client/domain': path.resolve(__dirname, './src/client/domain'),
			'@client/component': path.resolve(__dirname, './src/client/component'),
			'@client/hook': path.resolve(__dirname, './src/client/hook'),
			'@client/asset': path.resolve(__dirname, './src/client/assets'),
			'@shared': path.resolve(__dirname, './src/shared'),
			'#root': path.resolve(__dirname, '.'),
		},
	},
	plugins: [
		react({ jsxImportSource: '@emotion/react', babel: { plugins: ['@emotion/babel-plugin'] } }),
		vike(),
		nodePolyfills({ globals: { Buffer: true, global: true, process: true }, protocolImports: true }),
		topLevelAwait({
			// The export name of top-level await promise for each chunk module
			promiseExportName: '__tla',
			// The function to generate import names of top-level await promise in each chunk module
			promiseImportName: (i: any) => `__tla_${i}`,
		}),
	],
	build: {
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			external: [CHROMADB, ...builtinModules, ...nodeBuiltinModules, 'fsevents', /^node:.*/],
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
						return 'react-vendor';
					}
					if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) {
						return 'mui-vendor';
					}
					if (id.includes('node_modules/onnxruntime-web')) {
						return 'transformers';
					}
					if (id.includes('@langchain/')) {
						return 'langchain';
					}
				},
			},
		},
	},
	optimizeDeps: {
		include: [
			'@emotion/react',
			'@emotion/styled',
			'@emotion/cache',
			'hoist-non-react-statics',
			'buffer',
			'process',
		],
		exclude: [
			'chromadb',
			'totalist', // Add this line
			'sirv', // You might also need this
			'local-access', // And possibly this
		],
	},
	esbuild: {
		logOverride: { 'this-is-undefined-in-esm': 'silent', 'commonjs-variable-in-esm': 'silent' },
		logLevel: 'error',
		target: ['es2020'],
	},
});
