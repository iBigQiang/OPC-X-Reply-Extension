import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");

function functionBlock(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = source.indexOf("\n  function ", start + 1);
  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const candidates = [next, nextAsync].filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

function asyncFunctionBlock(name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `missing async function ${name}`);
  const next = source.indexOf("\n  function ", start + 1);
  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const candidates = [next, nextAsync].filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

test("textbox selection prefers the visible X dialog over page textboxes", () => {
  const block = functionBlock("getBestTextbox");
  const dialogIndex = block.indexOf("const dialogBoxes = getDialogTextboxes();");
  const pageActiveIndex = block.indexOf("!active.closest?.('.akiii-draft-panel')");

  assert.match(source, /function getDialogTextboxes\(\)/);
  assert.match(block, /active\.closest\?\.\('div\[role="dialog"\]'\)/);
  assert.ok(dialogIndex !== -1, "dialog textbox lookup is missing");
  assert.ok(pageActiveIndex !== -1, "page textbox fallback is missing");
  assert.ok(dialogIndex < pageActiveIndex, "dialog textbox should be checked before page fallback");
});

test("insert action targets the dialog textbox and the cached editor when both are visible", () => {
  const targets = asyncFunctionBlock("getInsertTargets");
  const clickHandlerStart = source.indexOf("insertBtn.addEventListener('click'");
  assert.notEqual(clickHandlerStart, -1, "missing insert click handler");
  const clickHandler = source.slice(clickHandlerStart, source.indexOf("      });", clickHandlerStart) + 10);

  assert.match(targets, /const dialogBoxes = getDialogTextboxes\(\);/);
  assert.match(targets, /add\(dialogBoxes\.at\(-1\)\);/);
  assert.match(targets, /add\(preferredEditor\);/);
  assert.match(clickHandler, /const targets = await getInsertTargets\(editor,\s*2500\);/);
  assert.match(clickHandler, /for \(const target of targets\)/);
});

test("composer injection scans X post buttons even when X splits them out of the toolbar", () => {
  const scan = functionBlock("scan");
  const inject = functionBlock("injectComposerButton");

  assert.match(source, /const POST_BUTTON_SELECTOR = /);
  assert.match(scan, /querySelectorAll\(POST_BUTTON_SELECTOR\)\]\.forEach\(injectComposerButton\)/);
  assert.match(inject, /getComposerRoot\(anchor\)/);
  assert.match(inject, /querySelector\?\.\(POST_BUTTON_SELECTOR\)/);
});

test("composer injection also scans inline reply textboxes on status pages", () => {
  const scan = functionBlock("scan");
  const root = functionBlock("getComposerRoot");

  assert.match(source, /const COMPOSER_CONTROL_SELECTOR = /);
  assert.match(source, /function hasComposerTextbox\(root\)/);
  assert.match(source, /function hasComposerControls\(root\)/);
  assert.match(root, /hasComposerTextbox\(node\) && hasComposerControls\(node\)/);
  assert.match(scan, /findVisibleTextboxes\(document\)\.forEach\(injectComposerButton\)/);
});

test("composer injection never appends the fill button into textbox-only fallback roots", () => {
  const root = functionBlock("getComposerRoot");
  const inject = functionBlock("injectComposerButton");

  assert.match(root, /node = isTextboxElement\(anchor\) \? anchor\.parentElement : anchor;/);
  assert.match(inject, /if \(!insertion \|\| insertion\.host\.closest\?\.\(TEXTBOX_SELECTOR\)\) return;/);
  assert.doesNotMatch(inject, /root\.appendChild\(btn\)/);
});

test("composer injection keeps rescanning when X reveals the status composer without adding nodes", () => {
  const scan = functionBlock("scan");
  const init = functionBlock("init");
  const observerStart = source.indexOf("STATE.observer.observe");
  assert.notEqual(observerStart, -1, "missing MutationObserver observe call");
  const observer = source.slice(observerStart, source.indexOf(");", observerStart) + 2);

  assert.match(source, /const INITIAL_SCAN_DELAYS = \[/);
  assert.match(source, /function scheduleFollowupScans\(\)/);
  assert.match(init, /scheduleFollowupScans\(\);/);
  assert.match(scan, /scheduleFollowupScans\(\);/);
  assert.match(observer, /attributes:\s*true/);
  assert.match(observer, /attributeFilter:\s*\[/);
});

test("article injection moves the status detail main tweet button to metadata row", () => {
  const detail = functionBlock("getDetailMainTweetMetaHost");
  const inject = functionBlock("injectArticleButton");

  assert.match(source, /function getCurrentStatusId\(\)/);
  assert.match(detail, /time\[datetime\]/);
  assert.match(detail, /a\[href\*="\/status\/"\]/);
  assert.match(detail, /data-testid="User-Name"/);
  assert.match(detail, /closestArticle\(link\) === article/);
  assert.match(inject, /const detailMetaHost = getDetailMainTweetMetaHost\(article\);/);
  assert.ok(
    inject.indexOf("const detailMetaHost = getDetailMainTweetMetaHost(article);") <
      inject.indexOf("replyButton.closest('[role=\"group\"]')"),
    "detail metadata row should be chosen before the action-group fallback"
  );
  assert.match(inject, /btn\.classList\.toggle\('akiii-detail-meta',\s*!!detailMetaHost\)/);
});

test("article injection keeps the timeline button in the native action group fallback", () => {
  const inject = functionBlock("injectArticleButton");
  const scan = functionBlock("scan");

  assert.match(inject, /replyButton\.closest\('\[role="group"\]'\)/);
  assert.match(inject, /createButton\('AI回',\s*'akiii-article'\)/);
  assert.match(inject, /\.\.\.targetHost\.children/);
  assert.match(inject, /targetHost\.insertBefore\(btn,\s*null\)/);
  assert.match(scan, /querySelectorAll\(ARTICLE_SELECTOR\)\]\.forEach\(injectArticleButton\)/);
});

test("article injection dedupes existing AI回 buttons before adding another one", () => {
  const helper = functionBlock("getArticleButtons");
  const inject = functionBlock("injectArticleButton");

  assert.match(helper, /querySelectorAll\(':scope \.akiii-ai-button\.akiii-article'\)/);
  assert.match(helper, /closestArticle\(button\) === article/);
  assert.match(inject, /const existingButtons = getArticleButtons\(article,\s*targetHost\);/);
  assert.match(inject, /existingButtons\.slice\(1\)\.forEach\(\(button\) => button\.remove\(\)\);/);
  assert.match(inject, /const existing = existingButtons\[0\];/);
});

test("article injection dedupes across X virtual-list cells by status id", () => {
  const helper = functionBlock("getArticleButtons");
  const inject = functionBlock("injectArticleButton");

  assert.match(helper, /const statusId = getStatusIdFromHref\(getStatusUrl\(article\)\);/);
  assert.match(helper, /\[data-testid="cellInnerDiv"\]/);
  assert.match(helper, /const buttonStatusId = button\.dataset\?\.akiiiStatusId \|\| '';/);
  assert.match(helper, /if \(statusId && buttonStatusId && buttonStatusId !== statusId\) return;/);
  assert.match(helper, /cell\.querySelectorAll\('\.akiii-ai-button\.akiii-article'\)/);
  assert.match(inject, /existing\.dataset\.akiiiStatusId = getStatusIdFromHref\(getStatusUrl\(article\)\);/);
  assert.match(inject, /btn\.dataset\.akiiiStatusId = getStatusIdFromHref\(getStatusUrl\(article\)\);/);
});

test("draft panel exposes dialog semantics without changing insert behavior", () => {
  const block = functionBlock("showDraftPanel");

  assert.match(block, /panel\.setAttribute\('role',\s*'dialog'\)/);
  assert.match(block, /panel\.setAttribute\('aria-labelledby'/);
  assert.match(block, /panel\.setAttribute\('aria-describedby'/);
  assert.match(block, /item\.setAttribute\('aria-labelledby',\s*`\$\{panelId\}-candidate-\$\{index \+ 1\}`\)/);
  assert.match(block, /<div class="akiii-draft-text-shell">/);
  assert.match(block, /<span class="akiii-draft-floating-label" id="\$\{panelId\}-candidate-\$\{index \+ 1\}">候选 \$\{index \+ 1\}<\/span>/);
  assert.match(block, /textarea class="akiii-draft-text" aria-label="候选 \$\{index \+ 1\} 回复内容"/);
  assert.match(block, /if \(event\.key === 'Escape'\)/);
  assert.match(block, /const targets = await getInsertTargets\(editor,\s*2500\);/);
});
