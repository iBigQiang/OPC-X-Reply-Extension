import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

test("extension action opens the standalone options page instead of a popup", () => {
  assert.equal(manifest.options_page, "options.html");
  assert.ok(manifest.action);
  assert.equal(Object.hasOwn(manifest.action, "default_popup"), false);
});
