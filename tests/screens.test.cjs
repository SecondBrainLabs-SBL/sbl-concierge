const test = require("node:test");
const assert = require("node:assert/strict");
const { labelCampaignControls } = require("../core/screens.js");

function fixture(count = 1, initial = {}) {
  const attrs = { ...initial };
  const control = { hasAttribute: (k) => k in attrs, setAttribute: (k, v) => { attrs[k] = v; } };
  const document = { querySelectorAll: (selector) => {
    assert.equal(selector, "div.cursor-pointer > svg.lucide-square-pen");
    return Array.from({ length: count }, () => ({ parentElement: control }));
  } };
  return { document, attrs };
}

test("campaign pencil gets a stable name for the engine, idempotently", () => {
  const { document, attrs } = fixture();
  labelCampaignControls(document, "/campaigns/9005");
  labelCampaignControls(document, "/campaigns/9005");
  assert.deepEqual(attrs, { role: "button", "aria-label": "Edit campaign name" });
});

test("does not guess among pencils or label another screen's edit control", () => {
  for (const path of ["/campaigns", "/campaigns/new", "/campaigns/9005/details", "/settings"]) {
    const { document, attrs } = fixture();
    labelCampaignControls(document, path);
    assert.deepEqual(attrs, {});
  }
  for (const count of [0, 2]) {
    const { document, attrs } = fixture(count);
    labelCampaignControls(document, "/campaigns/9005");
    assert.deepEqual(attrs, {});
  }
});

test("preserves the app's own semantics if it adds a label or role", () => {
  for (const initial of [{ role: "link" }, { "aria-label": "Edit details" }]) {
    const { document, attrs } = fixture(1, initial);
    labelCampaignControls(document, "/campaigns/9005");
    assert.deepEqual(attrs, initial);
  }
});
