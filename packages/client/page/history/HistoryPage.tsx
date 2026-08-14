import { Box, Grid, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router';
import { GlassCard, GlassPaper, GlassPortraitSlider } from '../../layout/component/glass/index.js';

import { useToast } from '../../provider/ToastProvider.jsx';

import { containerSpacing } from '../../style/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { HistoryInfo } from '@rita-berenice/shared/domain';

const HistoryPage: FC<{ historyInfo: HistoryInfo; imageUrl?: string; userId: string }> = ({
	historyInfo,
	imageUrl,
	userId,
}) => {
	const navigate = useNavigate();
	const { addToast } = useToast();
	// Portrait: pick default or first available

	return (
		<GlassPaper key="history-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Left Column */}
				<Grid
					size={{ xs: 12, md: 4 }}
					sx={{
						// Define this column as a sticky "pillar" on larger screens.
						position: { xs: 'static', md: 'sticky' },

						// Pin it to the top of the scrollable <main> area, respecting its padding.
						top: (theme) => theme.spacing(2),

						// Prevent this column from stretching if the right-side content is taller.
						alignSelf: 'flex-start',

						// --- THE CORRECTED HEIGHT CALCULATION ---
						// We subtract the header, footer, main's padding (2*2), and paper's padding (2*2).
						height: {
							xs: 'auto', // On mobile, height is automatic.
							md: (theme) =>
								`calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
						},
						// --- FLEXBOX CENTERING FOR THE IMAGE ---
						// These properties ensure the image is centered within the pillar and scales correctly.
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Box sx={{ height: '100%', width: '100%', display: 'flex' }}>
						{!!imageUrl ? (
							<GlassPortraitSlider imageUrls={[imageUrl]} />
						) : (
							<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
						)}
					</Box>
				</Grid>

				{/* Right Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 8 }}>
					<Box display="flex">
						<GlassCard variant="outlined">
							<Typography variant="subtitle1" color="text.secondary">
								{getLangText('SESSIONS_WITH_CHARACTER')}
							</Typography>
						</GlassCard>
					</Box>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default HistoryPage;
