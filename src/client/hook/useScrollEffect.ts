import { useState, useCallback, useRef } from 'react';

/**
 * Manages a "text consuming" scroll glow effect for a Virtuoso component.
 * - No glows when at an edge.
 * - While scrolling, a single glow appears on the side the text is scrolling away from.
 * - When scrolling stops in the middle, the last directional glow remains visible.
 */
export const useScrollEffect = () => {
	const [showTopGlow, setShowTopGlow] = useState(false);
	const [showBottomGlow, setShowBottomGlow] = useState(false);
	const [isScrolling, setIsScrolling] = useState(false);

	// Refs to track the list's state without causing re-renders
	const lastScrollOffset = useRef(0);
	const atTop = useRef(true);
	const atBottom = useRef(false);

	// This is the primary callback that drives the effect
	const isScrollingChange = useCallback((scrolling: boolean, scrollOffset?: number) => {
		setIsScrolling(scrolling);

		if (scrollOffset !== undefined && scrolling) {
			const direction = scrollOffset > lastScrollOffset.current ? 'down' : 'up';
			const hasScrolled = Math.abs(scrollOffset - lastScrollOffset.current) > 1;

			if (hasScrolled) {
				// If scrolling DOWN, show the top glow (unless we are at the top)
				if (direction === 'down') {
					setShowTopGlow(!atTop.current);
					setShowBottomGlow(false);
				}
				// If scrolling UP, show the bottom glow (unless we are at the bottom)
				else {
					setShowTopGlow(false);
					setShowBottomGlow(!atBottom.current);
				}
			}
		}

		if (scrollOffset !== undefined) {
			lastScrollOffset.current = scrollOffset;
		}
	}, []);

	// This callback acts as the final authority for the top edge
	const atTopStateChange = useCallback((isAtTop: boolean) => {
		atTop.current = isAtTop;
		if (isAtTop) {
			setShowTopGlow(false);
		}
	}, []);

	// This callback acts as the final authority for the bottom edge
	const atBottomStateChange = useCallback((isAtBottom: boolean) => {
		atBottom.current = isAtBottom;
		if (isAtBottom) {
			setShowBottomGlow(false);
		}
	}, []);

	return {
		atTopStateChange,
		atBottomStateChange,
		isScrollingChange,
		showTopGlow,
		showBottomGlow,
		isScrolling,
	};
};
