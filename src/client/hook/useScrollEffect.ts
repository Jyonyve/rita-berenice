// src/client/hook/useScrollEffects.ts
import { useState, useCallback, useRef } from 'react';
import { ListOnScrollProps } from 'react-window';

interface UseScrollEffectsProps {
	loadOlderMessages: () => void;
	hasMore: boolean;
	isLoadingChat: boolean;
}

/**
 * Manages all scroll-related effects for a virtualized list,
 * including infinite loading and directional scroll glows.
 */
export const useScrollEffect = ({
	loadOlderMessages,
	hasMore,
	isLoadingChat,
}: UseScrollEffectsProps) => {
	const [showTopGlow, setShowTopGlow] = useState(false);
	const [showBottomGlow, setShowBottomGlow] = useState(false);
	const [isScrolling, setIsScrolling] = useState(false);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const scrollTimeoutRef = useRef<number | null>(null);

	const handleScroll = useCallback(
		({ scrollOffset, scrollDirection }: ListOnScrollProps) => {
			// Set scrolling state and manage fade-out timer
			setIsScrolling(true);
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
			scrollTimeoutRef.current = window.setTimeout(() => {
				setIsScrolling(false);
			}, 150); // Fade out after 150ms of inactivity

			// Trigger infinite loading when near the top
			if (scrollOffset < 200 && hasMore && !isLoadingChat) {
				loadOlderMessages();
			}

			// Determine glow visibility based on scroll position and direction
			const container = scrollContainerRef.current;
			if (!container) return;

			const isAtTop = scrollOffset <= 10;
			const isAtBottom = scrollOffset >= container.scrollHeight - container.clientHeight - 10;

			if (scrollDirection === 'backward') {
				setShowTopGlow(false); // Hide top glow when scrolling down
				setShowBottomGlow(!isAtBottom);
			} else if (scrollDirection === 'forward') {
				setShowTopGlow(!isAtTop);
				setShowBottomGlow(false); // Hide bottom glow when scrolling up
			}
		},
		[loadOlderMessages, hasMore, isLoadingChat]
	);

	return { scrollContainerRef, handleScroll, showTopGlow, showBottomGlow, isScrolling };
};
