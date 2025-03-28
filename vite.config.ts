import { builtinModules } from 'module';
import react from '@vitejs/plugin-react-swc';
import mdx from '@mdx-js/rollup';
import vike from 'vike/plugin';
import { UserConfig } from 'vite';

const isServer = JSON.parse(process.env.SSR || 'false'); // Ensure boolean type
const external = ['chromadb'];

export default {
	define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV), global: 'globalThis' },
	ssr: {
		external: [...external, ...builtinModules], // `@langchain/community` 제거
		noExternal: ['@mui/material', '@emotion/react', '@emotion/styled', '@langchain/community'], // 번들링 강제
		resolveExternalConditions: isServer ? ['node'] : ['browser', 'module', 'import'],
	},
	build: {
		outDir: isServer ? 'dist/server' : 'dist/client',
		assetsDir: 'assets',
		manifest: true,
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			input: isServer ? 'src/renderer/+server.tsx' : 'src/renderer/+client.tsx',
			output: {
				format: 'esm',
				dir: isServer ? 'dist/server' : 'dist/client',
				entryFileNames: isServer ? '[name].mjs' : 'assets/[name]-[hash].js',
				chunkFileNames: isServer ? 'chunks/[name]-[hash].mjs' : 'assets/[name]-[hash].js',
				manualChunks: {
					'react-vendor': ['react', 'react-dom'],
					'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
					transformers: ['onnxruntime-web'],
					langchain: [
						'@langchain/anthropic',
						'@langchain/community',
						'@langchain/core',
						'@langchain/langgraph',
						'@langchain/ollama',
						'@langchain/openai',
					],
				},
			},
			external: [...builtinModules, ...external], // `@langchain/community` 제거
			onwarn(warning: { code: string; id: string | string[] }, warn: (arg0: any) => void) {
				if (warning.code === 'EVAL' && warning.id?.includes('onnxruntime-web')) {
					return;
				}
				warn(warning);
			},
		},
	},
	optimizeDeps: {
		include: ['@emotion/react', 'hoist-non-react-statics'],
		exclude: ['@mui/material', '@emotion/react', '@emotion/styled'],
	},
	plugins: [vike(), mdx(), react()],
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
