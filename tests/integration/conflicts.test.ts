import assert from "node:assert/strict";
import test from "node:test";
import { hasRevisionConflict, mergeDocumentContent } from "@/lib/conflicts";

test("stale revision without force is a conflict", () => {
  assert.equal(
    hasRevisionConflict({ baseRevision: 2, currentRevision: 3, force: false }),
    true
  );
});

test("same revision or forced save is not a conflict", () => {
  assert.equal(hasRevisionConflict({ baseRevision: 3, currentRevision: 3 }), false);
  assert.equal(
    hasRevisionConflict({ baseRevision: 2, currentRevision: 3, force: true }),
    false
  );
});

test("mergeDocumentContent keeps server and client versions", () => {
  const merged = mergeDocumentContent("<p>Server</p>", "<p>Client</p>", "<p>Base</p>");

  assert.match(merged, /Server/);
  assert.match(merged, /Merged local changes/);
  assert.match(merged, /Client/);
});

test("mergeDocumentContent accepts either side when only one side changed", () => {
  assert.equal(
    mergeDocumentContent("<p>Base</p>", "<p>Client</p>", "<p>Base</p>"),
    "<p>Client</p>"
  );
  assert.equal(
    mergeDocumentContent("<p>Server</p>", "<p>Base</p>", "<p>Base</p>"),
    "<p>Server</p>"
  );
});
