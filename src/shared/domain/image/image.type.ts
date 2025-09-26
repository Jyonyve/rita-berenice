export interface UploadedImage {
	file?: File;
	preview: string;
	crop?: { x: number; y: number; width: number; height: number };
}

export interface UploadedCharacterImage extends UploadedImage {
	emotion: string;
	emotionKey: number;
	toDelete?: boolean;
}
