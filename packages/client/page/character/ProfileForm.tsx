// src/client/components/profile/ProfileForm.tsx

import {
  Box,
  TextField,
  Typography,
  Grid,
  FormControl,
  FormHelperText,
  InputLabel,
  List,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ButtonBase,
  Select,
  Stack,
  FormControlLabel,
  Avatar,
  type SxProps,
  type Theme,
} from '@mui/material';
import { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GlassButton, ImageCropModal, SolidMetallicButton } from '../../layout/component/index.js';
import { AdultSwitch } from '../../layout/component/AdultSwitch.js';
import { innerSpacing } from '../../style/index.js';
import { getGenderSelectLabel, getLangText } from '../../util/translateUtils.js';
import { ProfilePreviewList } from './ProfilePreviewList.jsx';
import { useResponsive } from '../../hook/useResponsive.js';
import {
  getImageInputAccept,
  LANG_KEYS,
  LIMIT_5MB,
  REQUEST_CHARACTER_LIMIT,
  SUPPORTED_IMAGE_MIMETYPES,
} from '@rita-berenice/shared/config';
import { ProfileInfo, ProfileCdo, SessionContentPolicy } from '@rita-berenice/shared/domain';
import { useProfileApi } from '../../hook/api/useProfileApi.js';
import { useToast } from '../../provider/ToastProvider.js';
import { cleanupBlobUrl, processCroppedImage } from '../../util/cropImageUtils.js';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';
import { getCharacterCropAspect, getCharacterCropOutputSize, type CharacterCropStage } from './characterImageCrop.js';

const profileDialogSx: SxProps<Theme> = (theme) => ({
  '& .MuiBackdrop-root': {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  '& .MuiDialog-paper': {
    m: { xs: 2, sm: 4 },
    maxHeight: {
      xs: `calc(100dvh - ${theme.spacing(4)})`,
      sm: `calc(100dvh - ${theme.spacing(8)})`,
    },
  },
});

const getInitialFormData = (userId: string, profile?: ProfileInfo): ProfileCdo => {
  if (profile) {
    return {
      name: profile.name,
      gender: profile.gender,
      title: profile.title,
      showName: profile.showName,
      description: profile.description,
      userId,
      sessionId: profile.sessionId || '',
    };
  }

  return {
    name: '',
    gender: 'other',
    title: '',
    showName: '',
    description: '',
    userId,
    sessionId: '',
  };
};

export interface ProfileFormProps {
  userId: string;
  mode: 'create' | 'edit';
  profile?: ProfileInfo; // Required for edit mode
  portraitUrl?: string;
  avatarUrl?: string;
  open?: boolean; // For modal mode (edit)
  onClose?: () => void; // For modal mode (edit)
  onSubmit: (profileData: ProfileCdo | ProfileInfo, contentPolicy?: SessionContentPolicy) => Promise<void>;
  showTemplateSelector?: boolean; // Only for create mode
}

export const ProfileForm: FC<ProfileFormProps> = ({
  userId,
  mode,
  profile,
  portraitUrl,
  avatarUrl,
  open = true, // Default true for inline usage
  onClose,
  onSubmit,
  showTemplateSelector = false,
}) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ProfileCdo>({ defaultValues: getInitialFormData(userId, profile), mode: 'onBlur' });

  const { isSmallScreen } = useResponsive();
  const { addToast } = useToast();
  const { uploadProfileImage } = useProfileApi();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProfileInfo>();
  const [contentPolicy, setContentPolicy] = useState<SessionContentPolicy>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropStage, setCropStage] = useState<CharacterCropStage>('portrait');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPortraitCrop, setPendingPortraitCrop] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [localPortraitUrl, setLocalPortraitUrl] = useState(portraitUrl);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    reset(getInitialFormData(userId, profile));
  }, [userId, profile, reset]);

  useEffect(() => {
    setLocalPortraitUrl(portraitUrl);
    setLocalAvatarUrl(avatarUrl);
  }, [portraitUrl, avatarUrl]);

  useEffect(() => () => cleanupBlobUrl(localPortraitUrl), [localPortraitUrl]);
  useEffect(() => () => cleanupBlobUrl(localAvatarUrl), [localAvatarUrl]);

  const handleOpenTemplateModal = () => setIsTemplateModalOpen(true);
  const handleCloseTemplateModal = () => setIsTemplateModalOpen(false);

  const handleSelectProfile = (templateProfile: ProfileInfo) => {
    setSelectedTemplate(templateProfile);
  };

  const handleUseSelectedProfile = () => {
    if (!selectedTemplate) return;
    reset(getInitialFormData(userId, selectedTemplate));
    handleCloseTemplateModal();
  };

  const onFormSubmit = async (data: ProfileCdo): Promise<void> => {
    await onSubmit(data, mode === 'create' ? contentPolicy : undefined);
  };

  const resetCropFlow = () => {
    cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
    setPendingImageFile(null);
    setPendingPortraitCrop(null);
    setModalImageUrl('');
    setCropModalOpen(false);
    setCropStage('portrait');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!SUPPORTED_IMAGE_MIMETYPES.includes(file.type as never)) {
      addToast('Unsupported image type.', 'error');
      return;
    }
    if (file.size > LIMIT_5MB) {
      addToast('Image must be 5 MB or smaller.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = ({ target }) => {
      if (typeof target?.result !== 'string') return;
      setPendingImageFile(file);
      setModalImageUrl(target.result);
      setCropStage('portrait');
      setCropModalOpen(true);
    };
    reader.onerror = () => addToast('Could not read the image.', 'error');
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!pendingImageFile || !profile?.profileId) return;
    const croppedImage = processCroppedImage(croppedBlob, pendingImageFile.name);

    if (cropStage === 'portrait') {
      cleanupBlobUrl(pendingPortraitCrop?.previewUrl);
      setPendingPortraitCrop(croppedImage);
      setModalImageUrl(croppedImage.previewUrl);
      setCropStage('avatar');
      return;
    }

    if (!pendingPortraitCrop) throw new Error('Portrait crop is required before avatar crop.');
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', pendingPortraitCrop.file);
      formData.append('avatar', croppedImage.file);
      formData.append('profileId', profile.profileId);
      await uploadProfileImage(formData);

      cleanupBlobUrl(localPortraitUrl);
      cleanupBlobUrl(localAvatarUrl);
      setLocalPortraitUrl(pendingPortraitCrop.previewUrl);
      setLocalAvatarUrl(croppedImage.previewUrl);
      setPendingPortraitCrop(null);
      addToast('Profile portrait and avatar saved.', 'success');
    } catch (error) {
      cleanupBlobUrl(croppedImage.previewUrl);
      cleanupBlobUrl(pendingPortraitCrop.previewUrl);
      setPendingPortraitCrop(null);
      addToast(getClientErrorMessage(error, 'Could not save profile images.'), 'error');
    } finally {
      setIsUploadingImage(false);
      setPendingImageFile(null);
      setModalImageUrl('');
      setCropModalOpen(false);
      setCropStage('portrait');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formId = mode === 'edit' && profile ? `profile-edit-form-${profile.profileId}` : undefined;

  // Create the form content
  const formContent = (
    <Box id={formId} component="form" onSubmit={handleSubmit(onFormSubmit)} noValidate>
      {mode === 'create' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            mb: 1,
          }}
        >
          <Typography
            variant="subtitle1"
            color="text.secondary"
            component="span"
            sx={{ whiteSpace: 'nowrap', mb: isSmallScreen ? 0 : 1 }}
          >
            {getLangText(LANG_KEYS.CREATE_NEW_PROFILE)}
          </Typography>

          {showTemplateSelector && (
            <GlassButton
              colorVariant="silver"
              variant="outlined"
              onClick={handleOpenTemplateModal}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {getLangText(LANG_KEYS.CHOOSE_EXISTING_PROFILE)}
            </GlassButton>
          )}
        </Box>
      )}

      <Stack spacing={innerSpacing}>
        {mode === 'edit' && profile && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <ButtonBase
              component="label"
              disableRipple
              disabled={isUploadingImage}
              aria-label={getLangText(LANG_KEYS.SELECT_IMAGE)}
              sx={{
                position: 'relative',
                display: 'block',
                width: { xs: 150, sm: 180 },
                aspectRatio: '5 / 7',
                borderRadius: 1.5,
                overflow: 'visible',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'rgba(0, 0, 0, 0.2)',
                '&:hover, &.Mui-focusVisible': { borderColor: 'text.secondary' },
              }}
            >
              {localPortraitUrl ? (
                <Box
                  component="img"
                  src={localPortraitUrl}
                  alt={`${profile.showName} portrait`}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                />
              ) : (
                <Box sx={{ width: '100%', height: '100%' }} />
              )}
              <Avatar
                src={localAvatarUrl}
                alt={`${profile.showName} avatar`}
                sx={{
                  position: 'absolute',
                  right: -8,
                  bottom: -8,
                  width: 52,
                  height: 52,
                  border: '2px solid',
                  borderColor: 'background.paper',
                }}
              >
                {profile.showName.slice(0, 1)}
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                disabled={isUploadingImage}
                accept={getImageInputAccept()}
                onChange={handleImageUpload}
              />
            </ButtonBase>
          </Box>
        )}
        <Grid container spacing={innerSpacing}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              name="showName"
              control={control}
              rules={{ required: getLangText(LANG_KEYS.SHOW_NAME_REQUIRED) }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={getLangText(LANG_KEYS.SHOWNAME)}
                  error={!!errors.showName}
                  helperText={errors.showName?.message}
                  placeholder={getLangText(LANG_KEYS.SHOW_NAME_PLACEHOLDER)}
                  required
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Controller
              name="name"
              control={control}
              rules={{ required: getLangText(LANG_KEYS.NAME_REQUIRED) }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={getLangText(LANG_KEYS.NAME)}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  placeholder={getLangText(LANG_KEYS.NAME_PLACEHOLDER)}
                  required
                />
              )}
            />
          </Grid>
        </Grid>
        <Grid container spacing={innerSpacing}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth required>
              <Controller
                name="gender"
                control={control}
                rules={{ required: getLangText(LANG_KEYS.GENDER_REQUIRED) }}
                render={({ field }) => (
                  <FormControl fullWidth required error={!!errors.gender}>
                    {/* <InputLabel>{getLangText(LANG_KEYS.GENDER)}</InputLabel> */}
                    <Select {...field} inputProps={{ 'aria-label': getLangText(LANG_KEYS.GENDER) }}>
                      {getGenderSelectLabel().map((opt) => (
                        <MenuItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.gender && <FormHelperText>{errors.gender.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Controller
              name="title"
              control={control}
              rules={{ required: getLangText(LANG_KEYS.TITLE_REQUIRED) }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={getLangText(LANG_KEYS.TITLE)}
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  placeholder={getLangText(LANG_KEYS.TITLE_PLACEHOLDER)}
                  required
                  slotProps={{ htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT } }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Controller
          name="description"
          control={control}
          rules={{ required: getLangText(LANG_KEYS.DESCRIPTION_REQUIRED) }}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={getLangText(LANG_KEYS.DESCRIPTION)}
              multiline
              minRows={3}
              maxRows={10}
              error={!!errors.description}
              helperText={errors.description?.message || getLangText(LANG_KEYS.PROFILE_DESCRIPTION_HELPER)}
              placeholder={getLangText(LANG_KEYS.DESCRIPTION_PLACEHOLDER)}
              required
            />
          )}
        />
      </Stack>

      {mode === 'create' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) auto auto' },
            alignItems: 'center',
            gap: 1,
            pt: 1,
          }}
        >
          <TextField
            fullWidth
            label={getLangText(LANG_KEYS.SESSION_TITLE)}
            sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          />
          <FormControlLabel
            control={
              <AdultSwitch
                size="small"
                checked={contentPolicy === 'adult'}
                onChange={(_, checked) => setContentPolicy(checked ? 'adult' : 'general')}
                inputProps={{ 'aria-label': getLangText(LANG_KEYS.ADULT_SESSION) }}
              />
            }
            label={<Typography variant="body2">{getLangText(LANG_KEYS.ADULT_SESSION)}</Typography>}
            sx={{ m: 0, flexShrink: 0, justifySelf: 'start' }}
          />
          <SolidMetallicButton
            colorVariant="gold"
            type="submit"
            variant="outlined"
            disabled={isSubmitting}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {getLangText(LANG_KEYS.START_NEW_SESSION)}
          </SolidMetallicButton>
        </Box>
      )}

      {/* Template Selection Modal - Only for create mode */}
      {mode === 'create' && showTemplateSelector && (
        <Dialog
          open={isTemplateModalOpen}
          onClose={handleCloseTemplateModal}
          fullWidth
          maxWidth="sm"
          sx={profileDialogSx}
        >
          <DialogTitle sx={{ typography: 'subtitle1', px: 2, py: 1 }}>
            {getLangText(LANG_KEYS.CHOOSE_EXISTING_PROFILE)}
          </DialogTitle>
          <DialogContent dividers sx={{ p: 1 }}>
            <List disablePadding>
              <ProfilePreviewList
                userId={userId}
                selectedProfileId={selectedTemplate?.profileId}
                onSelectProfile={handleSelectProfile}
              />
            </List>
          </DialogContent>
          <DialogActions sx={{ p: 1 }}>
            <GlassButton onClick={handleCloseTemplateModal}>{getLangText(LANG_KEYS.CANCEL)}</GlassButton>
            <GlassButton
              colorVariant="silver"
              variant="outlined"
              disabled={!selectedTemplate}
              onClick={handleUseSelectedProfile}
            >
              {getLangText(LANG_KEYS.USE_PROFILE)}
            </GlassButton>
          </DialogActions>
        </Dialog>
      )}

      {pendingImageFile && modalImageUrl && (
        <ImageCropModal
          imageSrc={modalImageUrl}
          open={cropModalOpen}
          onClose={resetCropFlow}
          onCropComplete={handleCropComplete}
          aspect={getCharacterCropAspect(cropStage)}
          outputSize={getCharacterCropOutputSize(cropStage)}
          title={getLangText(
            cropStage === 'portrait' ? LANG_KEYS.CROP_PROFILE_PORTRAIT : LANG_KEYS.CROP_PROFILE_AVATAR,
          )}
        />
      )}
    </Box>
  );

  // Render as modal for edit mode, inline for create mode
  if (mode === 'edit') {
    const handleModalClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
      // This will prevent the modal from closing when the backdrop is clicked
      if (reason && reason === 'backdropClick') {
        return;
      }

      if (onClose) {
        onClose();
      }
    };

    return (
      <Dialog
        open={open || false}
        onClose={handleModalClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        sx={profileDialogSx}
      >
        <DialogTitle sx={{ typography: 'subtitle1', px: 2, py: 1 }}>{getLangText(LANG_KEYS.EDIT_PROFILE)}</DialogTitle>
        <DialogContent dividers sx={{ p: 1 }}>
          {formContent}
        </DialogContent>
        <DialogActions sx={{ p: 1 }}>
          {onClose && (
            <GlassButton onClick={onClose} disabled={isSubmitting}>
              {getLangText(LANG_KEYS.CANCEL)}
            </GlassButton>
          )}
          <GlassButton colorVariant="silver" variant="outlined" type="submit" form={formId} disabled={isSubmitting}>
            {getLangText(LANG_KEYS.UPDATE)}
          </GlassButton>
        </DialogActions>
      </Dialog>
    );
  }

  // Render inline for create mode
  return formContent;
};
