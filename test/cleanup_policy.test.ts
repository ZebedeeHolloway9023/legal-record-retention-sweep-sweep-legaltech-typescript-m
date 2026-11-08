import assert from "node:assert/strict";
import test from "node:test";
import { decideCleanup, type MatterRecord } from "../src/cleanup_policy";

const baseRecord: MatterRecord = {
  matterId: "matter-1042",
  intakeReceivedAt: "2025-01-02T09:00:00.000Z",
  signedDocumentKey: "matters/matter-1042/signed-engagement.pdf",
  signedDeliveredAt: "2025-01-03T09:00:00.000Z",
  deadlineFollowUpAt: "2025-01-20T09:00:00.000Z",
  deadlineStatus: "closed",
};

test("deletes an expired signed delivery after its deadline follow-up closes", () => {
  const decision = decideCleanup(baseRecord, new Date("2025-04-10T09:00:00.000Z"), 90);
  assert.deepEqual(decision, {
    matterId: "matter-1042",
    signedDocumentKey: "matters/matter-1042/signed-engagement.pdf",
    action: "delete",
    reason: "retention_elapsed",
  });
});

test("retains an expired delivery while deadline follow-up remains open", () => {
  const decision = decideCleanup(
    { ...baseRecord, deadlineStatus: "open" },
    new Date("2025-04-10T09:00:00.000Z"),
    90,
  );
  assert.equal(decision.action, "retain");
  assert.equal(decision.reason, "deadline_open");
});
