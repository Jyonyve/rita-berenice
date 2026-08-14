import { ASPECT_RATIOS, IMAGE_PROCESSING_CONFIG } from '@rita-berenice/shared/config';

export type CharacterCropStage = 'portrait' | 'avatar';

export const getCharacterCropAspect = (stage: CharacterCropStage): number =>
	stage === 'avatar' ? ASPECT_RATIOS.USER : ASPECT_RATIOS.CHARACTER;

export const getCharacterCropOutputSize = (
	stage: CharacterCropStage
): { width: number; height: number } =>
	stage === 'avatar'
		? IMAGE_PROCESSING_CONFIG.CHARACTER_AVATAR.dimensions
		: IMAGE_PROCESSING_CONFIG.CHARACTER_PORTRAIT.dimensions;
