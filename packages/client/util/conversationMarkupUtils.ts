export const DIRECTION_LABELS = {
	THIRD_PARTY: '제3자 개입',
	MOOD_SHIFT: '분위기 반전',
	FORESHADOW: '복선 회수',
	INITIATIVE: '상황 주도',
	SCENE_CHANGE: '장면 전환',
	TIME_SKIP: '시간 경과',
	NEW_EVENT: '사건 발생',
	CONTINUE: '이어서 진행',
} as const;

export type DirectionToken = keyof typeof DIRECTION_LABELS;

interface RichTextAstNode {
	type: string;
	value?: string;
	tagName?: string;
	children?: RichTextAstNode[];
}

const DIRECTION_TOKEN_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

export const localizeDirectionText = (text: string): string =>
	text.replace(DIRECTION_TOKEN_PATTERN, (original, token: string) =>
		token in DIRECTION_LABELS ? DIRECTION_LABELS[token as DirectionToken] : original
	);

const localizeRichTextAstTextNodes = (node: RichTextAstNode): void => {
	if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) return;
	if (node.type === 'text' && node.value) {
		node.value = localizeDirectionText(node.value);
	}
	node.children?.forEach(localizeRichTextAstTextNodes);
};

export const rehypeDirectionLabels =
	() =>
	(tree: RichTextAstNode): void => {
		localizeRichTextAstTextNodes(tree);
	};

const WITHOUT_FENCED_CODE = /```[\s\S]*?```/g;
const WITHOUT_INLINE_CODE = /`[^`\n]*`/g;
const EMBEDDED_ACTION = /(^|[^*])\*([^*\n]+)\*(?!\*)|<em\b/i;

export const containsEmbeddedRoleplayAction = (text: string): boolean =>
	EMBEDDED_ACTION.test(text.replace(WITHOUT_FENCED_CODE, '').replace(WITHOUT_INLINE_CODE, ''));
