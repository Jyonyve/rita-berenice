// src/client/component/GlassPortraitSlider.tsx

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y, Autoplay, EffectFade } from 'swiper/modules';
import { Box } from '@mui/material';
import { GlassPortrait } from './GlassPortrait.js';

// Import Swiper's core styles and the new EffectFade style
import 'swiper/css';
// import 'swiper/css/navigation';
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
		<Box sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
			<Swiper
				modules={[Pagination, A11y, EffectFade]}
				slidesPerView={1}
				loop={true}
				effect="fade"
				fadeEffect={{ crossFade: true }}
				style={{ overflow: 'visible' }}
				pagination={{ clickable: true }}
			>
				{imageUrls.map((url, index) => (
					<SwiperSlide key={index} >
						<GlassPortrait imageUrl={url} alt={`Character Portrait ${index + 1}`} />
					</SwiperSlide>
				))}
			</Swiper>
		</Box>
	);
};
