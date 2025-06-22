// src/client/component/common/ToastProvider.tsx

import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { Snackbar, Alert, Box } from '@mui/material';
import { keyframes } from '@emotion/react';

// --- Types & Context Definition ---
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextType {
	addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// --- Custom Animations with Emotion ---
const slideIn = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// --- Provider Component ---
export const ToastProvider = ({ children }: { children: ReactNode }) => {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [currentToast, setCurrentToast] = useState<Toast | null>(null);
	const [open, setOpen] = useState<boolean>(false);

	// Process the next toast in the queue
	React.useEffect(() => {
		if (toasts.length > 0 && !currentToast) {
			setCurrentToast(toasts[0]);
			setToasts((prev) => prev.slice(1));
			setOpen(true);
		}
	}, [toasts, currentToast]);

	/**
	 * Adds a new toast to the queue.
	 * @param message The message to display.
	 * @param type The type of toast (defaults to 'info').
	 */
	const addToast = useCallback((message: string, type: ToastType = 'info') => {
		const id = nanoid();
		setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
	}, []);

	const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
		// Prevent closing on click away, only on timer completion
		if (reason === 'clickaway') {
			return;
		}
		setOpen(false);
	};

	const handleExited = () => {
		// Clear the current toast after the exit animation is complete
		setCurrentToast(null);
	};

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			{currentToast && (
				<Snackbar
					open={open}
					autoHideDuration={4000} // Message auto-disappears after 4 seconds
					onClose={handleClose}
					TransitionProps={{ onExited: handleExited }}
					// Position the snackbar
					anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
					// Apply a custom entrance animation
					sx={{ '& .MuiPaper-root': { animation: `${slideIn} 0.4s cubic-bezier(0.16, 1, 0.3, 1)` } }}
				>
					{/* The Alert component automatically handles colors and icons */}
					<Alert
						onClose={(e) => handleClose(e)} // Provide a close button for accessibility
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

// --- Custom Hook for easy access ---
export const useToast = (): ToastContextType => {
	const context = useContext(ToastContext);
	if (context === undefined) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};
