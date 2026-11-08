import { z } from "zod";

export const matterRecordSchema = z.object({
  matterId: z.string().min(1),
  intakeReceivedAt: z.string().datetime(),
  signedDocumentKey: z.string().min(1),
  signedDeliveredAt: z.string().datetime(),
  deadlineFollowUpAt: z.string().datetime(),
  deadlineStatus: z.enum(["open", "closed"]),
});

export type MatterRecord = z.infer<typeof matterRecordSchema>;

export type CleanupDecision = {
  matterId: string;
  signedDocumentKey: string;
  action: "delete" | "retain";
  reason: "retention_elapsed" | "retention_active" | "deadline_open";
};

export function decideCleanup(
  record: MatterRecord,
  now: Date,
  retentionDays: number,
): CleanupDecision {
  const expiresAt = new Date(record.signedDeliveredAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);

  if (record.deadlineStatus === "open") {
    return {
      matterId: record.matterId,
      signedDocumentKey: record.signedDocumentKey,
      action: "retain",
      reason: "deadline_open",
    };
  }
  if (expiresAt.getTime() > now.getTime()) {
    return {
      matterId: record.matterId,
      signedDocumentKey: record.signedDocumentKey,
      action: "retain",
      reason: "retention_active",
    };
  }
  return {
    matterId: record.matterId,
    signedDocumentKey: record.signedDocumentKey,
    action: "delete",
    reason: "retention_elapsed",
  };
}
