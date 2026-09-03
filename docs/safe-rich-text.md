# Safe Rich Text

Rita renders read-only user and model content through the shared client `SafeRichText` component.
Editable inputs, stored values, API payloads, exports, and LLM/RAG prompt input remain unchanged plain
text.

## Security boundary

The renderer processes content in this order:

1. Parse Markdown with GitHub Flavored Markdown support.
2. Parse raw HTML into the same syntax tree.
3. Optionally localize known roleplay direction tokens in text nodes, excluding code spans and blocks.
4. Sanitize the tree with an explicit element allowlist and no allowed HTML attributes.
5. Create React elements from the sanitized tree.

It does not use `dangerouslySetInnerHTML`. Scripts, styles, frames, embedded objects, SVG, MathML,
templates, and forms are stripped. Links, images, controls, event handlers, URLs, inline styles, IDs,
and classes from source content are not allowed. Unsupported elements cannot introduce executable UI.

The allowed content elements are headings, paragraphs, emphasis, deletion, block quotes, line breaks,
lists, horizontal rules, code, tables, and native `details`/`summary` disclosures.

## roleplay direction tokens

Only conversation UI and session-message previews localize these known tokens:

- `{{THIRD_PARTY}}` → `제3자 개입`
- `{{MOOD_SHIFT}}` → `분위기 반전`
- `{{FORESHADOW}}` → `복선 회수`
- `{{INITIATIVE}}` → `상황 주도`
- `{{SCENE_CHANGE}}` → `장면 전환`
- `{{TIME_SKIP}}` → `시간 경과`
- `{{NEW_EVENT}}` → `사건 발생`
- `{{CONTINUE}}` → `이어서 진행`

Unknown tokens remain visible unchanged. Tokens inside inline or fenced code remain literal. This is a
display transform only and never changes persisted or model-visible content.
