import svgr from 'vite-plugin-svgr';
import { builtinModules } from 'module';
import reactSwc from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ command }) => {
	const isServer = process.env.SSR;

	return {
		define: { 'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV) },
		ssr: {
			external: ['chromadb', '@aws-sdk/*', '@smithy/*', ...builtinModules],
			noExternal: ['react', 'react-dom', '@mui/material', '@emotion/*'],
			resolveExternalConditions: isServer ? ['node'] : ['browser', 'module', 'import'],
		},
		build: {
			outDir: isServer ? 'dist/server' : 'dist/client',
			assetsDir: 'assets',
			manifest: true,
			rollupOptions: {
				input: isServer ? 'src/entry-server.tsx' : 'src/entry-client.tsx',
				output: isServer
					? {
							format: 'es',
							dir: 'dist/client',
							entryFileNames: '[name].mjs',
							chunkFileNames: 'chunks/[name]-[hash].mjs',
						}
					: {
							format: 'cjs',
							dir: 'dist/server',
							entryFileNames: '[name].cjs',
							chunkFileNames: 'chunks/[name]-[hash].cjs',
						},
				external: isServer
					? ['chromadb', '@aws-sdk/*', '@smithy/*', ...builtinModules]
					: [...builtinModules],
			},
		},
		optimizeDeps: { exclude: isServer ? ['chromadb', '@aws-sdk/*', '@smithy/*'] : [] },
		plugins: [reactSwc(), svgr(), tsconfigPaths()],
	};
});
