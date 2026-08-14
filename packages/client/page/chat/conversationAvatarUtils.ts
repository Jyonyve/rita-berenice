import type { PortraitUrlMap } from '@rita-berenice/shared/config';
import { getImageFallbackKeysForEmotion } from '../../util/portraitUtils.js';

export const getConversationAvatar = (
	avatarUrls: PortraitUrlMap | undefined,
	portraitUrls: PortraitUrlMap | undefined,
	emotion: string
): string | undefined => {
	for (const emotionKey of getImageFallbackKeysForEmotion(emotion)) {
		const imageUrl = avatarUrls?.[emotionKey] ?? portraitUrls?.[emotionKey];
		if (imageUrl) return imageUrl;
	}
	return undefined;
};
