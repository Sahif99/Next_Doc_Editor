import assert from "node:assert/strict";
import test from "node:test";
import { htmlToPlainText } from "@/lib/text";

test("htmlToPlainText strips tags and decodes common entities", () => {
  assert.equal(
    htmlToPlainText("<p>Hello&nbsp;<strong>world</strong>&amp; friends</p>"),
    "Hello world& friends"
  );
});

test("htmlToPlainText removes scripts", () => {
  assert.equal(htmlToPlainText("<script>alert(1)</script><p>Safe</p>"), "Safe");
});
