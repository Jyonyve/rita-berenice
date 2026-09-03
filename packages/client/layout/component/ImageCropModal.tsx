// client/layout/ImageCropModal.tsx
import { useState, useCallback, FC, useEffect } from 'react';
import { Dialog, DialogContent, DialogActions, DialogTitle, Box } from '@mui/material';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import * as ReactEasyCrop from 'react-easy-crop';
import { getCroppedImageBlob } from '../../util/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { GlassButton } from './glass/index.js';

const Cropper = (ReactEasyCrop as any).default || ReactEasyCrop;

interface ImageCropModalProps {
  imageSrc: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void | Promise<void>;
  aspect: number;
  outputSize: { width: number; height: number };
  title?: string;
}

export const ImageCropModal: FC<ImageCropModalProps> = ({
  imageSrc,
  open,
  onClose,
  onCropComplete,
  aspect = 5 / 7,
  outputSize,
  title,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) {
      console.warn('Missing crop data or image source');
      return;
    }

    try {
      setIsProcessing(true);
      // Use the crop utility to get actual cropped blob
      const croppedBlob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, outputSize);
      await onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
      // You can add toast notification here if available
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [imageSrc, open]);

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onClose}
      aria-label={title ? undefined : getLangText(LANG_KEYS.CROP_IMAGE)}
      maxWidth="md"
      fullWidth
      slots={{ transition: undefined }}
      transitionDuration={200}
    >
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent aria-busy={isProcessing}>
        <Box sx={(theme) => ({ position: 'relative', height: { xs: '50dvh', sm: theme.spacing(50) } })}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteHandler}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <GlassButton onClick={onClose} disabled={isProcessing}>
          {getLangText(LANG_KEYS.CANCEL)}
        </GlassButton>
        <GlassButton
          colorVariant="silver"
          variant="outlined"
          onClick={handleSave}
          disabled={isProcessing || !croppedAreaPixels}
          aria-busy={isProcessing}
        >
          {getLangText(isProcessing ? LANG_KEYS.PROCESSING : LANG_KEYS.SAVE)}
        </GlassButton>
      </DialogActions>
    </Dialog>
  );
};
