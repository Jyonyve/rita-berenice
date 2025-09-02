import { LANG_KEYS } from '#shared/config/langConstants.js';
import { TextField } from '@mui/material';
import React, { FC } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { getLangText } from '../../util/translateUtils.js';
import { useSessionApi } from '../../hook/index.ts';

/**
 * A reusable form component for entering a session title.
 * This component is designed to be used within a FormProvider context from react-hook-form.
 */
export const SessionTitleForm: FC = () => {
	// useFormContext allows us to access the form state from a parent FormProvider
	const {
		control,
		formState: { errors },
	} = useFormContext<{ title: string }>();
	const { updateSession } = useSessionApi();

	return (
		<Controller
			name="title"
			control={control}
			rules={{ maxLength: { value: 100, message: getLangText(LANG_KEYS.ERROR_MAXLENGTH) } }}
			render={({ field }) => (
				<TextField
					{...field}
					fullWidth
					label={getLangText(LANG_KEYS.SESSION_TITLE)}
					variant="outlined"
					autoFocus
					error={!!errors.title}
					helperText={errors.title ? errors.title.message : ''}
				/>
			)}
		/>
	);
};
