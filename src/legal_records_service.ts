import { createServer, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { z } from "zod";
import { decideCleanup, matterRecordSchema, type MatterRecord } from "./cleanup_policy";
import { InfraiError, infrai } from "./infrai";

const intakeSchema = matterRecordSchema;
const sweepSchema = z.object({ now: z.string().datetime().optional() }).strict();
const records = new Map<string, MatterRecord>();
const bucket = process.env.LEGAL_DOCUMENT_BUCKET ?? "legal-signed-deliveries";
const retentionDays = Number(process.env.RETENTION_DAYS ?? "90");

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function jsonBody(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/matters/intake") {
      const record = intakeSchema.parse(await jsonBody(request));
      records.set(record.matterId, record);
      return send(response, 201, { accepted: record.matterId });
    }

    if (request.method === "POST" && request.url === "/internal/legal-records/sweep") {
      const input = sweepSchema.parse(await jsonBody(request));
      const now = input.now ? new Date(input.now) : new Date();
      const decisions = [...records.values()].map((record) =>
        decideCleanup(record, now, retentionDays),
      );
      const expired = decisions.filter((item) => item.action === "delete");

      if (expired.length > 0) {
        const keys = expired.map((item) => item.signedDocumentKey);
        const batch = createHash("sha256").update([...keys].sort().join("\n")).digest("hex");
        const sweepId = `legal-sweep-${now.toISOString().slice(0, 10)}-${batch}`;
        await infrai.storage.object.delete_batch(bucket, { keys }, sweepId);
        for (const item of expired) records.delete(item.matterId);
      }

      return send(response, 200, {
        scanned: decisions.length,
        deleted: expired.map((item) => item.matterId),
        retained: decisions.filter((item) => item.action === "retain"),
      });
    }

    return send(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return send(response, 400, { error: "invalid_request", issues: error.issues });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.code, message: error.message });
    }
    return send(response, 500, { error: "request_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? "3000");
  server.listen(port, () => console.log(`Legal record service listening on ${port}`));
}
