import { Box, Typography } from '@mui/material';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../../util/translateUtils.js';
import { diffDocumentLines } from './documentDiffUtils.js';

type DocumentDiffProps = { before: string; after: string };

export function DocumentDiff({ before, after }: DocumentDiffProps) {
	const lines = diffDocumentLines(before, after);

	return (
		<Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
			<Box sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
				<Typography variant="subtitle2">{getLangText(LANG_KEYS.DOCUMENT_COMPARISON)}</Typography>
			</Box>
			<Box sx={{ maxHeight: 420, overflow: 'auto', py: 0.5 }}>
				{lines.map((line, index) => (
					<Box
						key={`${line.kind}-${line.oldLineNumber ?? ''}-${line.newLineNumber ?? ''}-${index}`}
						sx={{
							display: 'grid',
							gridTemplateColumns: '3rem 3rem minmax(0, 1fr)',
							bgcolor:
								line.kind === 'removed'
									? 'rgba(211, 47, 47, 0.14)'
									: line.kind === 'added'
										? 'rgba(46, 125, 50, 0.16)'
										: 'transparent',
						}}
					>
						<Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: 'right' }}>
							{line.oldLineNumber ?? ''}
						</Typography>
						<Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: 'right' }}>
							{line.newLineNumber ?? ''}
						</Typography>
						<Typography
							component="pre"
							variant="body2"
							sx={{
								m: 0,
								px: 1,
								whiteSpace: 'pre-wrap',
								overflowWrap: 'anywhere',
								fontFamily: 'monospace',
							}}
						>
							{line.kind === 'removed' ? '- ' : line.kind === 'added' ? '+ ' : '  '}
							{line.text || ' '}
						</Typography>
					</Box>
				))}
			</Box>
		</Box>
	);
}
