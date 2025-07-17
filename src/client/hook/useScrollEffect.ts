import React, { useState, useRef, useCallback, useEffect } from 'react';

type ScrollDirection = 'up' | 'down' | null;

/**
 * Enhanced scroll effect hook that combines react-virtuoso's API with direct DOM access
 * for maximum responsiveness - identical to react-window behavior.
 */
export const useScrollEffect = () => {
	const [isScrolling, setIsScrolling] = useState(false);
	const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
	const scrollContainerElement = useRef<HTMLElement | null>(null);
	const lastScrollTop = useRef<number>(0);
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	/**
	 * Direct scroll event handler - this gives us the real-time responsiveness
	 * that react-window provided through outerRef.
	 */
	const handleScroll = useCallback((event: Event) => {
		const target = event.target as HTMLDivElement;
		const currentScrollTop = target.scrollTop;

		// Determine scroll direction based on scroll position change
		if (currentScrollTop > lastScrollTop.current) {
			setScrollDirection('down'); // Scrolling down (newer messages)
		} else if (currentScrollTop < lastScrollTop.current) {
			setScrollDirection('up'); // Scrolling up (older messages)
		}

		lastScrollTop.current = currentScrollTop;
		setIsScrolling(true);

		// Clear any existing timeout and set a new one
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		// Reset scrolling state after scroll stops (same as react-window behavior)
		scrollTimeoutRef.current = setTimeout(() => {
			setIsScrolling(false);
			setScrollDirection(null);
		}, 150); // 150ms matches typical scroll momentum timing
	}, []);

	/**
	 * Callback function for Virtuoso's scrollerRef prop
	 * Fixed to match the expected type signature and behavior
	 */
	const scrollerRef = useCallback(
		(ref: HTMLElement | Window | null) => {
			// Remove listener from previous element
			if (scrollContainerElement.current instanceof HTMLElement) {
				scrollContainerElement.current.removeEventListener('scroll', handleScroll);
			}

			// Store the new element and add listener only if it's an HTMLElement
			if (ref instanceof HTMLElement) {
				ref.addEventListener('scroll', handleScroll, { passive: true });
				scrollContainerElement.current = ref;
			} else {
				// Handle Window case or null - we only care about HTMLElement for scroll events
				scrollContainerElement.current = null;
			}

			// Don't return anything - Virtuoso expects void or any, not a cleanup function
		},
		[handleScroll]
	);

	/**
	 * Cleanup function to be called when component unmounts
	 */
	const cleanup = useCallback(() => {
		if (scrollContainerElement.current instanceof HTMLElement) {
			scrollContainerElement.current.removeEventListener('scroll', handleScroll);
		}
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}
	}, [handleScroll]);

	// Use cleanup in a useEffect for proper component unmounting
	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	/**
	 * Fallback handler for react-virtuoso's isScrolling prop
	 * This ensures we don't miss any scroll state changes
	 */
	const handleIsScrollingChange = useCallback((scrolling: boolean) => {
		if (!scrolling) {
			setIsScrolling(false);
			setScrollDirection(null);
		}
	}, []);

	const showTopGlow = scrollDirection === 'down';
	const showBottomGlow = scrollDirection === 'up';

	return {
		// State for the ScrollGlow component
		isScrolling,
		showTopGlow,
		showBottomGlow,

		// Callback function for Virtuoso's scrollerRef (now with correct type)
		scrollerRef,

		// Callback for Virtuoso's isScrolling prop (fallback only)
		isScrollingChange: handleIsScrollingChange,
	};
};
