// scripts/build-server.js
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Assumes scripts folder is one level down from root

// List all packages that should NOT be bundled
// Includes:
// - Native Node addons (.node files): onnxruntime-node, sharp, chromadb (often uses native parts)
// - Common server frameworks/middleware: express, compression
// - Dev/build tools if imported in server.ts (less common for prod build): vite, sirv (if only used for dev static serving)
// - Add any other packages that cause .node errors or are better left external
const externalPackages = [
	// Node.js 내장 모듈 (필수)
	'util',
	'path',
	'fs',
	'http',
	'stream',
	'crypto',
	'events',
	'url',

	// 네이티브 애드온 포함 패키지
	'sharp',
	'onnxruntime-node',

	// 서버 미들웨어/라이브러리
	'express',
	'compression',
	'sirv',

	// 빌드/개발 관련 (서버 번들 시 외부 처리)
	'vite',

	// 동적 require 문제 패키지 (에러 나면 추가)
	'combined-stream',
	'form-data',

	// DB 관련
	'chromadb',

	// Puppeteer (무거운 패키지는 외부 처리 권장)
	'puppeteer',
];

console.log('🚀 Starting esbuild server build...');

try {
	await esbuild.build({
		entryPoints: [path.resolve(projectRoot, 'server.ts')], // Use absolute path for entry point
		outfile: path.resolve(projectRoot, 'dist/server.js'), // Use absolute path for output
		bundle: true,
		platform: 'node',
		format: 'esm', // Matches your project's "type": "module"
		target: 'node18',
		external: externalPackages,
		logLevel: 'info', // Show warnings and errors
		sourcemap: true, // Generate sourcemaps for easier debugging
		loader: {
			'.scss': 'empty', // 💡 .scss 파일을 빈 모듈로 대체
		},
		// You might add 'minify: true' for production builds later
		// minify: process.env.NODE_ENV === 'production',
	});
	console.log('✅ Server build successful: dist/server.js');
} catch (error) {
	console.error('❌ Server build failed:');
	// esbuild errors often don't have a stack trace, so the error object itself is informative
	// console.error(error); // Uncomment if the default logging isn't enough
	process.exit(1); // Exit with error code
}
