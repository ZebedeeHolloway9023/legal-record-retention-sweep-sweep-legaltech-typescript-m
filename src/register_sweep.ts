import { InfraiError, infrai } from "./infrai";

const bucket = process.env.LEGAL_DOCUMENT_BUCKET ?? "legal-signed-deliveries";
const serviceUrl = process.env.SERVICE_URL ?? "http://localhost:3000";
const task = new URL("/internal/legal-records/sweep", serviceUrl).toString();

try {
  await infrai.storage.bucket.create({ name: bucket }, `bucket-${bucket}`);
} catch (error) {
  if (!(error instanceof InfraiError && error.status === 409)) throw error;
}
const job = await infrai.cron.create(
  { cron_expr: "0 2 * * *", task },
  `legal-record-sweep-${task}`,
);

console.log(JSON.stringify({ bucket, job_id: job.job_id, task }, null, 2));
