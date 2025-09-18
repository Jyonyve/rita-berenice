import { useState, useCallback, FC, ChangeEvent, useEffect, forwardRef } from 'react';
import { Dialog, DialogContent, DialogActions, Button, Box, Fade, Slide } from '@mui/material';
import * as ReactEasyCrop from 'react-easy-crop';
const Cropper = (ReactEasyCrop as any).default || ReactEasyCrop;

interface ImageCropModalProps {
	imageSrc: string;
	open: boolean;
	onClose: () => void;
	onCropComplete: (croppedAreaPixels: any) => void;
	aspect: number;
}

export const ImageCropModal: FC<ImageCropModalProps> = ({
	imageSrc,
	open,
	onClose,
	onCropComplete,
	aspect = 5 / 7,
}) => {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

	const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
		setCroppedAreaPixels(croppedAreaPixels);
	}, []);

	const handleSave = () => {
		if (croppedAreaPixels) {
			onCropComplete(croppedAreaPixels);
		}
		onClose();
	};

	useEffect(() => {
		return () => {
			if (imageSrc && imageSrc.startsWith('blob:')) {
				URL.revokeObjectURL(imageSrc);
			}
		};
	}, [imageSrc]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			slots={{ transition: undefined }}
			transitionDuration={200}
		>
			<DialogContent>
				<Box sx={{ position: 'relative', height: 400 }}>
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						aspect={aspect} // Character aspect ratio
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropCompleteHandler}
					/>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Cancel</Button>
				<Button onClick={handleSave} variant="contained">
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
};
