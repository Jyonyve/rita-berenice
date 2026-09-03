import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import createEmotionServer from '@emotion/server/create-instance';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ConversationEntry } from './ConversationEntry.tsx';
import { ConversationMessage } from './ConversationMessage.tsx';
import type { ChatMessage } from '@rita-berenice/shared/domain';
import { getGlassEffect } from '../../style/glassEffect.ts';
import { lightChromeBackground, lightPalette } from '../../style/colors.ts';
import { chatStyles, chatSurfaceStyles, getChatTextColors } from '../../style/chatStyles.ts';
import { GlassMenuItem } from '../../layout/component/glass/GlassMenuItem.tsx';
import { createTheme } from '@mui/material/styles';
import { getGlobalScrollbarStyles, getTheme } from '../../style/globalStyle.ts';

const message = (role: 'user' | 'assistant', showName: string): ChatMessage => ({
  sessionId: 'session-1',
  sequence: 1,
  messageType: role === 'user' ? 'request' : 'response',
  role,
  showName,
  messageId: `${role}-message`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  emotion: 'neutral',
  type: 'message',
  model: 'test-model',
  entries: [{ type: 'dialogue', prompt: `${showName} message` }],
});

test('renders a canonical action entry with its role-specific action class', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry entry={{ type: 'action', prompt: 'A quiet gesture.' }} role="assistant" />,
  );

  assert.match(markup, /class="[^"]*\bassistantAction\b[^"]*"/);
  assert.match(markup, />A quiet gesture\.<\/p>/);
});

test('renders embedded asterisk actions without styling surrounding dialogue as an action', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry entry={{ type: 'dialogue', prompt: 'Hello. *A quiet gesture.* Welcome.' }} role="user" />,
  );

  assert.match(markup, /class="[^"]*\buserDialogue\b[^"]*"/);
  assert.match(markup, /class="[^"]*\buserAction\b[^"]*"/);
  assert.doesNotMatch(markup, /\*A quiet gesture\.\*/);
});

test('renders details and summary as native disclosure elements with normal text styling', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry
      entry={{
        type: 'action',
        prompt: '<details><summary>Scene details</summary><p>Hidden body</p></details>',
      }}
      role="assistant"
    />,
  );

  assert.match(markup, /<details/);
  assert.match(markup, /<summary/);
  assert.match(markup, />Scene details<\/summary>/);
  assert.match(markup, />Hidden body<\/p>/);
  assert.match(markup, /font-size:inherit/);
  assert.match(markup, /font-style:normal/);
});

test('renders Markdown and strips executable markup and attributes', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry
      entry={{
        type: 'dialogue',
        prompt:
          '**Safe bold** <strong onclick="alert(1)">also safe</strong><script>alert(2)</script><img src=x onerror="alert(3)">',
      }}
      role="assistant"
    />,
  );

  assert.match(markup, /<strong>Safe bold<\/strong>/);
  assert.match(markup, /<strong>also safe<\/strong>/);
  assert.doesNotMatch(markup, /onclick|onerror|<script|<img/);
});

test('keeps markup and direction tokens literal inside Markdown code', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry
      entry={{ type: 'dialogue', prompt: '`<img src=x onerror=alert(1)> {{CONTINUE}}`' }}
      role="assistant"
    />,
  );

  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt; \{\{CONTINUE\}\}/);
  assert.doesNotMatch(markup, /<img/);
});

test('localizes known direction tokens only in rendered chat text', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry
      entry={{
        type: 'dialogue',
        prompt: '<details><summary>{{SCENE_CHANGE}}</summary>{{CONTINUE}}</details> / {{UNKNOWN_DIRECTION}}',
      }}
      role="assistant"
      localizeDirections
    />,
  );

  assert.match(markup, /장면 전환/);
  assert.match(markup, /이어서 진행/);
  assert.match(markup, /\{\{UNKNOWN_DIRECTION\}\}/);
  assert.doesNotMatch(markup, /\{\{SCENE_CHANGE\}\}/);
});

test('preserves intentional line breaks without expanding structural list newlines', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry
      entry={{ type: 'dialogue', prompt: '첫 줄\n둘째 줄\n\n- 첫째\n- 둘째\n- 셋째' }}
      role="assistant"
    />,
  );

  assert.match(markup, /첫 줄<br\/>\s*둘째 줄/);
  assert.match(markup, /<li[^>]*>첫째<\/li>/);
  assert.doesNotMatch(markup, /white-space:pre-line/);
});

test('renders messenger cards on opposite sides with the supplied avatars', () => {
  const userMarkup = renderToStaticMarkup(
    <ConversationMessage message={message('user', 'Noel')} role="user" avatarUrl="/profile.webp" />,
  );
  const npcMarkup = renderToStaticMarkup(
    <ConversationMessage message={message('assistant', 'Ari')} role="assistant" avatarUrl="/npc.webp" />,
  );

  assert.match(userMarkup, /data-chat-side="user"/);
  assert.match(userMarkup, /flex-direction:row-reverse/);
  assert.match(userMarkup, /0 0 14px 2px/);
  assert.match(userMarkup, /src="\/profile.webp"/);
  assert.match(npcMarkup, /data-chat-side="npc"/);
  assert.match(npcMarkup, /flex-direction:row/);
  assert.match(npcMarkup, /src="\/npc.webp"/);
});

test('shared glass effects separate hover and glow controls', () => {
  const glowingEffect = getGlassEffect('dark');
  const noGlowEffect = getGlassEffect('dark', { noGlow: true });
  const staticEffect = getGlassEffect('dark', { withHover: false });

  assert.match(glowingEffect['&:hover']?.boxShadow ?? '', /0 0 14px 2px/);
  assert.doesNotMatch(noGlowEffect['&:hover']?.boxShadow ?? '', /0 0 14px 2px/);
  assert.ok(noGlowEffect['&:hover']);
  assert.equal(noGlowEffect['&:focus-within'], undefined);
  assert.equal(noGlowEffect['&:active'], undefined);
  assert.equal(staticEffect['&:hover'], undefined);
  assert.equal(staticEffect['&:focus-within'], undefined);
  assert.equal(staticEffect['&:active'], undefined);
});

test('glass menu items can keep hover behavior without rendering a glow', () => {
  const markup = renderToStaticMarkup(<GlassMenuItem noGlow>Settings</GlassMenuItem>);

  assert.match(markup, /background-color:rgba\(/);
  assert.match(markup, /box-shadow:none/);
  assert.doesNotMatch(markup, /noGlow/);
});

test('chat text uses readable role colors in light mode and preserves dark colors', () => {
  assert.equal(chatStyles['.userDialogue'].color, 'var(--chat-dialogue-color)');
  assert.equal(chatStyles['.userAction'].color, 'var(--chat-action-color)');
  assert.equal(chatStyles['.assistantDialogue'].color, 'var(--chat-dialogue-color)');
  assert.equal(chatStyles['.assistantAction'].color, 'var(--chat-action-color)');
  assert.equal(getChatTextColors('light').userLabel, '#315F6B');
  assert.equal(getChatTextColors('light').assistantLabel, '#7A5A00');
  assert.equal(getChatTextColors('light').userDialogue, '#315F6B');
  assert.equal(getChatTextColors('light').userAction, '#625F58');
  assert.equal(getChatTextColors('light').assistantDialogue, '#3F3A34');
  assert.equal(getChatTextColors('dark').userLabel, '#00A9FF');
  assert.equal(getChatTextColors('dark').assistantLabel, '#A0E9FF');
  assert.equal(getChatTextColors('dark').userDialogue, '#818CF8');
  assert.equal(getChatTextColors('dark').userAction, '#A3A3A3');
  assert.equal(getChatTextColors('dark').assistantDialogue, '#FFFFFF');
  assert.equal(getChatTextColors('dark').assistantAction, '#FFC200');
});

test('chat entries scope role colors on the rendered element for SSR-safe theme changes', () => {
  const markup = renderToStaticMarkup(
    <ConversationEntry entry={{ type: 'dialogue', prompt: 'Readable text.' }} role="assistant" />,
  );

  assert.match(markup, /--chat-dialogue-color:#3F3A34/);
  assert.match(markup, /--chat-action-color:#7A5A00/);
});

test('light chat surfaces separate conversation cards and veil the mobile book background', () => {
  assert.equal(chatSurfaceStyles.light.conversationCanvas, '#F6F1E6');
  assert.equal(chatSurfaceStyles.light.userMessage, 'rgba(248, 245, 238, 0.72)');
  assert.equal(chatSurfaceStyles.light.userMessageHover, 'rgba(255, 252, 246, 0.86)');
  assert.equal(chatSurfaceStyles.light.assistantMessage, 'rgba(255, 252, 246, 0.58)');
  assert.equal(chatSurfaceStyles.light.bookOverlay, 'rgba(248, 245, 238, 0.84)');
  assert.equal(chatSurfaceStyles.dark.bookOverlay, 'rgba(0, 0, 0, 0.6)');
  // Light mode veils the input bar twice so the portrait's dark lower half cannot read as a
  // band behind it; dark mode deliberately leaves that area unveiled.
  assert.equal(chatSurfaceStyles.light.bookInputVeil, 'rgba(248, 245, 238, 0.55)');
  assert.equal(chatSurfaceStyles.dark.bookInputVeil, 'transparent');
  assert.equal(lightChromeBackground, 'rgba(246, 241, 230, 0.82)');
  assert.equal(lightPalette.background.default, '#F7F4ED');
});

test('the book background veils rather than blurs, leaning on the text shadow variable', () => {
  assert.equal(chatSurfaceStyles.light.bookBackdropFilter, 'none');
  assert.equal(chatSurfaceStyles.dark.bookBackdropFilter, 'none');
  assert.equal(chatStyles['.userDialogue'].textShadow, 'var(--chat-text-shadow)');
  assert.equal(chatStyles['.assistantDialogue'].textShadow, 'var(--chat-text-shadow)');
  assert.equal(chatStyles['.userAction'].textShadow, 'var(--chat-text-shadow)');
  assert.equal(chatStyles['.assistantAction'].textShadow, 'var(--chat-text-shadow)');
});

test('global scrollbars stay thin with transparent tracks and stronger interaction feedback', () => {
  const styles = getGlobalScrollbarStyles(createTheme());
  const scrollbarStyles = styles['*'];

  assert.equal(scrollbarStyles.scrollbarWidth, 'thin');
  assert.equal(scrollbarStyles['&::-webkit-scrollbar'].width, 6);
  assert.equal(scrollbarStyles['&::-webkit-scrollbar-track'].backgroundColor, 'transparent');
  assert.notEqual(
    scrollbarStyles['&::-webkit-scrollbar-thumb'].backgroundColor,
    scrollbarStyles['&:hover::-webkit-scrollbar-thumb'].backgroundColor,
  );
});

test('chat font size and weight settings win the cascade against Typography body1 styles', () => {
  // The entry classes declare the font variables in global CSS, but MUI injects the
  // Typography root rule after them at equal specificity, and body1 (1rem/400) would
  // therefore override the session font settings. ConversationEntry must re-declare the
  // variables through sx so they land inside the Typography rule itself, after body1.
  const cache = createCache({ key: 'mui' });
  const { extractCriticalToChunks } = createEmotionServer(cache);
  const html = renderToString(
    <CacheProvider value={cache}>
      <ThemeProvider theme={getTheme('dark')}>
        <CssBaseline />
        <ConversationEntry entry={{ type: 'dialogue', prompt: 'Readable text.' }} role="assistant" />
      </ThemeProvider>
    </CacheProvider>,
  );

  const css = extractCriticalToChunks(html)
    .styles.map((chunk) => chunk.css)
    .join('\n');
  const typographyRule = css
    .match(/\.mui-[^{]*-MuiTypography-root\{[^}]*\}/g)
    ?.find((rule) => rule.includes('font-size:1rem'));

  assert.ok(typographyRule, 'expected the entry Typography root rule to be extracted');
  assert.ok(
    typographyRule.includes('font-size:var(--chat-font-size'),
    'entry rule must re-declare the font size variable after the body1 value',
  );
  assert.ok(
    typographyRule.includes('font-weight:var(--chat-font-weight'),
    'entry rule must re-declare the font weight variable after the body1 value',
  );
  assert.ok(
    typographyRule.indexOf('font-size:var(--chat-font-size') > typographyRule.indexOf('font-size:1rem') &&
      typographyRule.indexOf('font-weight:var(--chat-font-weight') > typographyRule.indexOf('font-weight:400'),
    'the variable declarations must come after the body1 values to win the cascade',
  );
});
