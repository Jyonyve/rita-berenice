import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsEmbeddedRoleplayAction,
  rehypeDirectionLabels,
  localizeDirectionText,
} from './conversationMarkupUtils.ts';

test('localizes known direction tokens and preserves unknown tokens', () => {
  assert.equal(
    localizeDirectionText('{{SCENE_CHANGE}} / {{CONTINUE}} / {{CUSTOM}}'),
    '장면 전환 / 이어서 진행 / {{CUSTOM}}',
  );
});

test('direction-token rich-text transform leaves code nodes literal', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'text', value: '{{TIME_SKIP}}' },
      { type: 'element', tagName: 'code', children: [{ type: 'text', value: '{{TIME_SKIP}}' }] },
      { type: 'element', tagName: 'pre', children: [{ type: 'text', value: '{{TIME_SKIP}}' }] },
    ],
  };

  rehypeDirectionLabels()(tree);

  assert.deepEqual(tree.children, [
    { type: 'text', value: '시간 경과' },
    { type: 'element', tagName: 'code', children: [{ type: 'text', value: '{{TIME_SKIP}}' }] },
    { type: 'element', tagName: 'pre', children: [{ type: 'text', value: '{{TIME_SKIP}}' }] },
  ]);
});

test('embedded roleplay-action detection ignores Markdown code', () => {
  assert.equal(containsEmbeddedRoleplayAction('Dialogue *action*'), true);
  assert.equal(containsEmbeddedRoleplayAction('`*literal*`'), false);
  assert.equal(containsEmbeddedRoleplayAction('```\n*literal*\n```'), false);
});
