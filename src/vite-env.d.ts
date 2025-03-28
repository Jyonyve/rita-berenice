/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
	readonly VITE_APP_TITLE: string;
	// Add other env variables here
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
