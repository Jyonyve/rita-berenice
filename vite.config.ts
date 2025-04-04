import { builtinModules } from 'module';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import vike from 'vike/plugin';
import { UserConfig } from 'vite';

const CHROMADB = 'chromadb' as const;
export default {
	define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV), global: 'globalThis' },
	ssr: {
		external: [CHROMADB, ...builtinModules],
		noExternal: [
			'@mui/material',
			'@mui/styled-engine',
			'@emotion/react',
			'@emotion/styled',
			'@emotion/cache',
			'@emotion/server',
			'@emotion/utils',
			'@langchain/community',
		], // 번들링 강제
	},
	resolve: {
		// externalConditions: ['node'], // Ensure this is removed or commented out
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
	],
	build: {
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			external: [...builtinModules, ...CHROMADB],
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
	// esbuild: { logOverride: { 'this-is-undefined-in-esm': 'silent', EVAL: 'silent' } },
	optimizeDeps: {
		include: ['@emotion/react', '@emotion/styled', '@emotion/cache', 'hoist-non-react-statics'],
		exclude: [
			// '@mui/material', '@emotion/react', '@emotion/styled' // Keep existing excludes if needed
			'chromadb', // Exclude chromadb from optimization/pre-bundling for the browser
		],
	},
} satisfies UserConfig;

// export default defineConfig(({ command }) => {
// 	const isServer = JSON.parse(process.env.SSR || 'false'); // Ensure boolean type
// 	const external = ['chromadb'];

// 	return {
// define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV), global: 'globalThis' },
// ssr: {
// 	external: [...external, ...builtinModules], // `@langchain/community` 제거
// 	noExternal: ['@mui/material', '@emotion/react', '@emotion/styled', '@langchain/community'], // 번들링 강제
// 	resolveExternalConditions: isServer ? ['node'] : ['browser', 'module', 'import'],
// },
// build: {
// 	outDir: isServer ? 'dist/server' : 'dist/client',
// 	assetsDir: 'assets',
// 	manifest: true,
// 	chunkSizeWarningLimit: 1000,
// 	rollupOptions: {
// 		input: isServer ? 'src/renderer/+server.tsx' : 'src/renderer/+client.tsx',
// 		output: {
// 			format: 'esm',
// 			dir: isServer ? 'dist/server' : 'dist/client',
// 			entryFileNames: isServer ? '[name].mjs' : 'assets/[name]-[hash].js',
// 			chunkFileNames: isServer ? 'chunks/[name]-[hash].mjs' : 'assets/[name]-[hash].js',
// 			manualChunks: {
// 				'react-vendor': ['react', 'react-dom'],
// 				'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
// 				transformers: ['onnxruntime-web'],
// 				langchain: [
// 					'@langchain/anthropic',
// 					'@langchain/community',
// 					'@langchain/core',
// 					'@langchain/langgraph',
// 					'@langchain/ollama',
// 					'@langchain/openai',
// 				],
// 			},
// 		},
// 		external: [...builtinModules, ...external], // `@langchain/community` 제거
// 		onwarn(warning, warn) {
// 			if (warning.code === 'EVAL' && warning.id?.includes('onnxruntime-web')) {
// 				return;
// 			}
// 			warn(warning);
// 		},
// 	},
// },
// optimizeDeps: {
// 	include: ['@emotion/react', 'hoist-non-react-statics'],
// 	exclude: ['@mui/material', '@emotion/react', '@emotion/styled'],
// },

// 		plugins: [reactSwc(), svgr(), tsconfigPaths(), vike({ prerender: true })],
// 	};
// });
