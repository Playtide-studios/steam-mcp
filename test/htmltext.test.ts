import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excerpt, htmlToText } from '../src/htmltext.ts';

test('htmlToText converts HTML blocks, lists, and links', () => {
  const out = htmlToText('<p><strong>Patch</strong> notes</p><ul><li>one</li><li>two</li></ul><a href="https://example.com/x">details</a>');
  assert.ok(out.includes('Patch'));
  assert.ok(out.includes('- one'));
  assert.ok(out.includes('details (https://example.com/x)'));
  assert.ok(!out.includes('<'), 'no tags survive');
});

test('htmlToText converts BBCode bodies (Steam community feed format)', () => {
  const out = htmlToText('[p][b]MAP SCRIPTING[/b][/p][list][*][p]Added custom_hud_layout entity[/p][*][p]Fixed a crash[/p][/list][url=https://example.com]Read more[/url]');
  assert.ok(out.includes('MAP SCRIPTING'));
  assert.ok(out.includes('- \nAdded custom_hud_layout entity') || out.includes('- Added custom_hud_layout entity'));
  assert.ok(out.includes('Read more (https://example.com)'));
  assert.ok(!out.includes('['), 'no bbcode survives');
});

test('htmlToText drops images and strips invisible characters', () => {
  const out = htmlToText('[img]https://x/y.png[/img]hello​world');
  assert.equal(out, 'helloworld');
});

test('excerpt bounds length on one line', () => {
  const out = excerpt(`a\n\nb ${'x'.repeat(500)}`, 100);
  assert.ok(out.length <= 101);
  assert.ok(!out.includes('\n'));
});
