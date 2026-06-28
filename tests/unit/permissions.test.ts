import assert from "node:assert/strict";
import test from "node:test";

test("getUserRole detects owner from populated owner object", async () => {
  process.env.MONGODB_URI ||= "mongodb://localhost:27017/test";
  const { getUserRole } = await import("@/lib/permissions");

  const role = getUserRole(
    {
      owner: { _id: "u1", name: "Owner" },
      collaborators: [],
    },
    "u1"
  );

  assert.equal(role, "OWNER");
});

test("getUserRole detects collaborator from populated user object", async () => {
  process.env.MONGODB_URI ||= "mongodb://localhost:27017/test";
  const { getUserRole } = await import("@/lib/permissions");

  const role = getUserRole(
    {
      owner: "owner-id",
      collaborators: [{ user: { _id: "u2" }, role: "EDITOR" }],
    },
    "u2"
  );

  assert.equal(role, "EDITOR");
});
