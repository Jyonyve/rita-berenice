import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { Snackbar, Alert } from '@mui/material';

interface Toast {
	id: number; // ✅ Changed from string to number
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration?: number;
}

interface ToastContextType {
	addToast: (
		message: string,
		type?: 'success' | 'error' | 'info' | 'warning',
		duration?: number
	) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0; // ✅ Simple counter

export const ToastProvider = ({ children }: { children: ReactNode }) => {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [currentToast, setCurrentToast] = useState<Toast | null>(null);
	const [open, setOpen] = useState<boolean>(false);

	React.useEffect(() => {
		if (toasts.length > 0 && !currentToast) {
			setCurrentToast(toasts[0]);
			setToasts((prev) => prev.slice(1));
			setOpen(true);
		}
	}, [toasts, currentToast]);

	const addToast = useCallback(
		(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000) => {
			const id = toastIdCounter++; // ✅ Increment counter
			setToasts((prevToasts) => [...prevToasts, { id, message, type, duration }]);
		},
		[]
	);

	const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
		if (reason === 'clickaway') return;
		setOpen(false);
	};

	const handleExited = () => setCurrentToast(null);

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			{currentToast && (
				<Snackbar
					open={open}
					autoHideDuration={currentToast.duration}
					onClose={handleClose}
					slotProps={{ transition: { onExited: handleExited } }}
					anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
				>
					<Alert
						onClose={(e) => handleClose(e)}
						severity={currentToast.type}
						variant="filled"
						sx={{ width: '100%' }}
					>
						{currentToast.message}
					</Alert>
				</Snackbar>
			)}
		</ToastContext.Provider>
	);
};

export const useToast = (): ToastContextType => {
	const context = useContext(ToastContext);
	if (context === undefined) throw new Error('useToast must be used within a ToastProvider');
	return context;
};
