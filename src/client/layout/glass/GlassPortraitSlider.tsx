// src/client/component/GlassPortraitSlider.tsx

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y, Autoplay, EffectFade } from 'swiper/modules'; // Import new modules
import { Box } from '@mui/material';
import { GlassPortrait } from './GlassPortrait.js';

// Import Swiper's core styles and the new EffectFade style
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface GlassPortraitSliderProps {
	imageUrls: string[];
}

export const GlassPortraitSlider: React.FC<GlassPortraitSliderProps> = ({ imageUrls }) => {
	if (!imageUrls || imageUrls.length === 0) {
		return null;
	}

	return (
		// This Box provides a stable container with a defined width for Swiper.
		// This is the primary fix for the "exploding" layout bug.
		<Box sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
			<Swiper
				// --- Core Configuration ---
				modules={[Pagination, A11y, EffectFade]}
				slidesPerView={1} // Always show only one slide
				loop={true}
				// --- Effect Configuration ---
				effect="fade" // Use a fade transition instead of a slide
				fadeEffect={{ crossFade: true }}
				// --- Navigation ---
				pagination={{ clickable: true }}
			>
				{imageUrls.map((url, index) => (
					<SwiperSlide key={index}>
						{/* No need for the isActive prop with a single-slide fade effect */}
						<GlassPortrait imageUrl={url} alt={`Character Portrait ${index + 1}`} />
					</SwiperSlide>
				))}
			</Swiper>
		</Box>
	);
};
