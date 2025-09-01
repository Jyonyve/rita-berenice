// src/client/components/profile/ProfileTabs.tsx

import { LANG_KEYS } from '#shared/config/langConstants.js';
import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';
import { Box, CardContent, Tab, Tabs } from '@mui/material';
import { FC, useState } from 'react';
import { GlassCard } from '../../layout/glass/index.js'; // Assuming GlassCard is here
import { getLangText } from '../../util/translateUtils.js';
import { ProfileForm } from './ProfileForm.js';
import { HistoryPreviewList } from './HistoryPreviewList.jsx';

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

const TabPanel: FC<TabPanelProps> = ({ children, value, index, ...other }) => (
	<div
		role="tabpanel"
		hidden={value !== index}
		id={`profile-tabpanel-${index}`}
		aria-labelledby={`profile-tab-${index}`}
		{...other}
	>
		{value === index && <Box sx={{ p: { xs: 1, sm: 2 } }}>{children}</Box>}
	</div>
);

export const ProfileHistoryTabs: FC<{
	userId: string;
	characterId: string;
	onSubmit: (profileData: ProfileCdo) => Promise<void>;
	onHistory: (historyId: string) => void;
}> = ({ userId, characterId, onSubmit, onHistory }) => {
	const [tabValue, setTabValue] = useState(0);

	const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
		setTabValue(newValue);
	};

	return (
		<GlassCard variant="outlined">
			<Tabs
				value={tabValue}
				onChange={handleTabChange}
				aria-label="profile card tabs"
				variant="fullWidth"
				sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.22)' }}
			>
				<Tab label={getLangText(LANG_KEYS.CREATE_NEW_PROFILE)} />
				<Tab label={getLangText(LANG_KEYS.STORY)} />
			</Tabs>

			<TabPanel value={tabValue} index={0}>
				<ProfileForm userId={userId} onSubmit={onSubmit} mode={'create'} showTemplateSelector={true} />
			</TabPanel>

			<TabPanel value={tabValue} index={1}>
				<HistoryPreviewList characterId={characterId} handleHistory={onHistory} />
			</TabPanel>
		</GlassCard>
	);
};
