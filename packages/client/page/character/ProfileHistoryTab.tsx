// src/client/components/profile/ProfileTabs.tsx

import { Box } from '@mui/material';
import { FC, SyntheticEvent, useState } from 'react';
import { GlassCard, GlassTab, GlassTabs } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { HistoryPreviewList } from './HistoryPreviewList.jsx';
import { CharacterLorePreviewList } from './CharacterLorePreviewList.js';
import { LANG_KEYS } from '@rita-berenice/shared/config';

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
    {value === index && <Box>{children}</Box>}
  </div>
);

export const CharacterLoreHistoryTabs: FC<{
  characterId: string;
  onHistory: (historyId: string) => void;
}> = ({ characterId, onHistory }) => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <GlassCard variant="outlined">
      <GlassTabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label={getLangText(LANG_KEYS.CHARACTER_CONTENT_TABS)}
        variant="fullWidth"
        textColor="inherit"
      >
        <GlassTab
          id="profile-tab-0"
          aria-controls="profile-tabpanel-0"
          label={getLangText(LANG_KEYS.CHARACTER_SETTINGS)}
        />
        <GlassTab id="profile-tab-1" aria-controls="profile-tabpanel-1" label={getLangText(LANG_KEYS.STORY)} />
      </GlassTabs>

      <TabPanel value={tabValue} index={0}>
        <CharacterLorePreviewList characterId={characterId} />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <HistoryPreviewList characterId={characterId} handleHistory={onHistory} />
      </TabPanel>
    </GlassCard>
  );
};
