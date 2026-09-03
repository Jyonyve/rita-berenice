// src/client/components/profile/ProfilePreviewList.tsx

import { Box, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FC } from 'react';
import { useProfileApi } from '../../hook/api/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { SafeRichText } from '../../layout/component/SafeRichText.js';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { ProfileInfo } from '@rita-berenice/shared/domain';

export const ProfilePreviewList: FC<{
  userId: string;
  selectedProfileId?: string;
  onSelectProfile: (profileInfo: ProfileInfo) => void;
}> = ({ userId, selectedProfileId, onSelectProfile }) => {
  const { data: profileRes, isLoading, error } = useProfileApi().getAllProfilesByUserId(userId);

  if (isLoading) {
    return (
      <ListItem sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box role="status">
          <GlassCircularProgress colorVariant="silver" aria-label={getLangText(LANG_KEYS.LOADING_PROFILES)} />
        </Box>
      </ListItem>
    );
  }
  if (error) {
    return (
      <ListItem>
        <ListItemText
          primary={
            <Typography role="alert" variant="body2" color="error">
              {getClientErrorMessage(error, 'Could not load profiles.')}
            </Typography>
          }
        />
      </ListItem>
    );
  }
  if (!profileRes?.profileInfos?.length) {
    return (
      <ListItem>
        <ListItemText
          primary={
            <Typography variant="body2" color="text.secondary">
              {getLangText(LANG_KEYS.NO_PROFILES)}
            </Typography>
          }
        />
      </ListItem>
    );
  }

  return (
    <>
      {profileRes.profileInfos.map((profile) => (
        <ListItem key={profile.profileId} disablePadding sx={{ '&:not(:last-child)': { mb: 1 } }}>
          <ListItemButton
            selected={profile.profileId === selectedProfileId}
            onClick={() => onSelectProfile(profile)}
            aria-pressed={profile.profileId === selectedProfileId}
            sx={{
              alignItems: 'flex-start',
              border: '1px solid',
              borderColor: profile.profileId === selectedProfileId ? 'text.secondary' : 'divider',
              borderRadius: 1,
              px: 2,
              py: 1.5,
            }}
          >
            <ListItemText
              primary={
                <Typography variant="subtitle2" fontWeight="bold">
                  {profile.showName}
                </Typography>
              }
              secondary={
                <SafeRichText
                  text={profile.description}
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 0.5,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 3,
                  }}
                />
              }
              disableTypography
            />
          </ListItemButton>
        </ListItem>
      ))}
    </>
  );
};
