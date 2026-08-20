import { Avatar, Box, Toolbar, Tooltip, Typography } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageIcon from '@mui/icons-material/Image';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../util/translateUtils.js';
import { titleFontFamily } from '../style/typography.js';
import { GlassAppBar } from './component/glass/index.js';
import { InlineEditableField } from './component/InlineEditableField.js';
import { HeaderIconButton, RomanticTitle } from './component/index.js';
import {
	AccountMenuControl,
	type AccountMenuControlProps,
} from './component/AccountMenuControl.js';

export const SESSION_CONTROLS_ID = 'session-controls';

export interface SessionHeaderInfo {
	characterId: string;
	profileShowName: string;
	avatarUrl?: string;
	mobileImageUrl?: string;
	sessionId?: string;
	sessionTitle?: string;
	editModalOpen?: boolean;
}

type SessionHeaderProps = {
	info: SessionHeaderInfo;
	onCharacter: () => void;
	onProfile: () => void;
	onSession: () => void;
	onSessionTitleSave: (title: string) => void;
	onDocuments: () => void;
	onImage: () => void;
	hidden?: boolean;
} & AccountMenuControlProps;

export function SessionHeader({
	info,
	onCharacter,
	onProfile,
	onSession,
	onSessionTitleSave,
	onDocuments,
	onImage,
	hidden = false,
	isLoggedIn,
	isSessionLoading,
	isMenuOpen,
	menuAnchor,
	userAvatarUrl,
	onAccountMenuOpen,
	onAccountMenuClose,
	onLogin,
	onUser,
	onMyCharacters,
	onLogout,
}: SessionHeaderProps) {
	return (
		<GlassAppBar
			sx={{
				display: hidden ? 'none' : 'block',
				width: '100%',
				position: 'static',
				borderTop: 1,
				borderColor: 'divider',
				boxShadow: 'none',
			}}
		>
			<Toolbar sx={{ minHeight: { xs: 52, sm: 56 }, gap: 1 }}>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						flex: 1,
						minWidth: 0,
						gap: 1,
						overflow: 'hidden',
					}}
				>
					<HeaderIconButton size="small" onClick={onCharacter} aria-label={info.characterId}>
						<Avatar src={info.avatarUrl} variant="circular" sx={{ width: 36, height: 36 }}>
							<AccountCircleIcon />
						</Avatar>
					</HeaderIconButton>
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-start',
							minWidth: 0,
							overflow: 'hidden',
						}}
					>
						<Typography
							variant="body1"
							fontFamily={titleFontFamily}
							role="button"
							color="secondary"
							onClick={onProfile}
							sx={{
								maxWidth: '100%',
								cursor: 'pointer',
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								'&:hover': { textDecoration: 'underline' },
							}}
						>
							{info.profileShowName}
						</Typography>
						{info.sessionId && info.sessionTitle !== undefined && (
							<InlineEditableField
								initialValue={info.sessionTitle}
								onSave={onSessionTitleSave}
								onTextClick={onSession}
								showEditButton
								typographyProps={{
									color: 'textPrimary',
									variant: 'caption',
									sx: { maxWidth: { xs: '180px', md: '320px' } },
								}}
								textFieldProps={{ variant: 'standard', size: 'small' }}
							/>
						)}
					</Box>
					<RomanticTitle
						variant="subtitle1"
						colorVariant="silver"
						component="div"
						onClick={onDocuments}
						role="button"
						sx={{ display: { xs: 'none', md: 'block' }, px: 1, whiteSpace: 'nowrap' }}
					>
						{getLangText(LANG_KEYS.SESSION_DOCUMENTS)}
					</RomanticTitle>
				</Box>

				<Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
					<Tooltip title={getLangText(LANG_KEYS.SESSION_DOCUMENTS)}>
						<HeaderIconButton
							size="small"
							onClick={onDocuments}
							aria-label={getLangText(LANG_KEYS.SESSION_DOCUMENTS)}
							sx={{ display: { xs: 'inline-flex', md: 'none' } }}
						>
							<DescriptionOutlinedIcon />
						</HeaderIconButton>
					</Tooltip>
					{info.mobileImageUrl && (
						<Tooltip title={getLangText(LANG_KEYS.VIEW_CHARACTER_IMAGE)}>
							<HeaderIconButton onClick={onImage} aria-label={getLangText(LANG_KEYS.VIEW_CHARACTER_IMAGE)}>
								<ImageIcon />
							</HeaderIconButton>
						</Tooltip>
					)}
					<Box id={SESSION_CONTROLS_ID} sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} />
					<AccountMenuControl
						isLoggedIn={isLoggedIn}
						isSessionLoading={isSessionLoading}
						isMenuOpen={isMenuOpen}
						menuAnchor={menuAnchor}
						userAvatarUrl={userAvatarUrl}
						onAccountMenuOpen={onAccountMenuOpen}
						onAccountMenuClose={onAccountMenuClose}
						onLogin={onLogin}
						onUser={onUser}
						onMyCharacters={onMyCharacters}
						onLogout={onLogout}
					/>
				</Box>
			</Toolbar>
		</GlassAppBar>
	);
}
