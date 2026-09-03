import { Box, Typography } from '@mui/material';
import type { SxProps, Theme, TypographyProps } from '@mui/material';
import type { ChatRoleType } from '@rita-berenice/shared/domain';
import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { rehypeDirectionLabels } from '../../util/conversationMarkupUtils.js';
import { styleEntryFont } from '../../util/styleUtils.jsx';

const SAFE_RICH_TEXT_TAGS = [
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'details',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
] as const;

const safeRichTextSchema = {
  ...defaultSchema,
  tagNames: [...SAFE_RICH_TEXT_TAGS],
  attributes: {},
  protocols: {},
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'form'],
};

const remarkPlugins = [remarkGfm, remarkBreaks];
const standardRehypePlugins: NonNullable<Parameters<typeof ReactMarkdown>[0]['rehypePlugins']> = [
  rehypeRaw,
  [rehypeSanitize, safeRichTextSchema],
];
const chatRehypePlugins: NonNullable<Parameters<typeof ReactMarkdown>[0]['rehypePlugins']> = [
  rehypeRaw,
  rehypeDirectionLabels,
  [rehypeSanitize, safeRichTextSchema],
];

const heading = (level: 1 | 2 | 3 | 4 | 5 | 6, children: ReactNode) => (
  <Box component={`h${level}`} sx={{ mt: 1.25, mb: 0.75, fontSize: `${1.45 - level * 0.08}em` }}>
    {children}
  </Box>
);

const buildComponents = (role?: ChatRoleType): Components => ({
  h1: ({ children }) => heading(1, children),
  h2: ({ children }) => heading(2, children),
  h3: ({ children }) => heading(3, children),
  h4: ({ children }) => heading(4, children),
  h5: ({ children }) => heading(5, children),
  h6: ({ children }) => heading(6, children),
  p: ({ children }) => (
    <Box component="p" sx={{ my: 0.75 }}>
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box component="blockquote" sx={{ my: 1, mx: 0, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
      {children}
    </Box>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ my: 0.75, pl: 3 }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ my: 0.75, pl: 3 }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Box component="li" sx={{ mb: 0.25 }}>
      {children}
    </Box>
  ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        my: 1,
        p: 1,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'action.selected',
        borderRadius: 1,
      }}
    >
      {children}
    </Box>
  ),
  code: ({ children }) => (
    <Box component="code" sx={{ px: 0.4, py: 0.1, backgroundColor: 'action.selected', borderRadius: 0.5 }}>
      {children}
    </Box>
  ),
  details: ({ children }) => (
    <Box
      component="details"
      sx={{
        my: 1,
        borderLeft: 2,
        borderColor: role === 'user' ? 'primary.main' : 'warning.main',
        borderRadius: 1,
        backgroundColor: 'action.hover',
        color: 'text.secondary',
        fontStyle: 'normal',
        fontWeight: 400,
        overflow: 'hidden',
        '& > :not(summary)': { mx: 1 },
      }}
    >
      {children}
    </Box>
  ),
  summary: ({ children }) => (
    <Box
      component="summary"
      sx={{
        cursor: 'pointer',
        px: 1,
        py: 0.75,
        fontSize: 'inherit',
        lineHeight: 'inherit',
        fontWeight: 700,
        fontStyle: 'normal',
        color: 'text.secondary',
        userSelect: 'none',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '-2px',
        },
      }}
    >
      {children}
    </Box>
  ),
  em: ({ children }) =>
    role ? (
      <Box component="em" className={styleEntryFont(role, 'action')} sx={{ fontStyle: 'normal' }}>
        {children}
      </Box>
    ) : (
      <em>{children}</em>
    ),
  table: ({ children }) => (
    <Box sx={{ overflowX: 'auto', my: 1 }}>
      <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }}>
        {children}
      </Box>
    </Box>
  ),
  th: ({ children }) => (
    <Box component="th" sx={{ border: 1, borderColor: 'divider', p: 0.75, textAlign: 'start' }}>
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box component="td" sx={{ border: 1, borderColor: 'divider', p: 0.75 }}>
      {children}
    </Box>
  ),
});

const standardComponents = buildComponents();
const chatComponents: Record<ChatRoleType, Components> = {
  user: buildComponents('user'),
  assistant: buildComponents('assistant'),
  system: buildComponents('system'),
};

export interface SafeRichTextProps {
  text: string;
  role?: ChatRoleType;
  localizeDirections?: boolean;
  variant?: TypographyProps['variant'];
  color?: TypographyProps['color'];
  className?: string;
  style?: CSSProperties;
  sx?: SxProps<Theme>;
}

export function SafeRichText({
  text,
  role,
  localizeDirections = false,
  variant,
  color,
  className,
  style,
  sx,
}: SafeRichTextProps) {
  return (
    <Typography
      component="div"
      variant={variant}
      color={color}
      className={className}
      style={style}
      sx={{ overflowWrap: 'anywhere', lineHeight: 1.65, ...sx }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={localizeDirections ? chatRehypePlugins : standardRehypePlugins}
        components={role ? chatComponents[role] : standardComponents}
      >
        {text}
      </ReactMarkdown>
    </Typography>
  );
}
