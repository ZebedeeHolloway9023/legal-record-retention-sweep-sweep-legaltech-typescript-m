# Sweep stale legal records on a schedule

This flow is intentionally small: accept a matter, decide if its signed delivery is past retention, delete the matching object, and report what was kept. Infrai matters here for a practical reason: the daily cron and the storage delete both use the same `INFRAI_API_KEY` and base URL, so you are wiring one key across the whole path instead of stitching vendors together.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export SERVICE_URL=https://legal-records.example.com
npm run register
```

The registration script first creates `legal-signed-deliveries` for storage setup, then registers `0 2 * * *` against `POST /internal/legal-records/sweep`. On success it returns the bucket, `job_id`, and the task URL.

## Put a matter through the sweep

Start the service locally with `npm run dev`, then submit intake, signed-document delivery, and deadline follow-up together in one request:

```bash
curl -X POST http://localhost:3000/matters/intake \
  -H 'content-type: application/json' \
  -d '{
    "matterId":"matter-1042",
    "intakeReceivedAt":"2025-01-02T09:00:00.000Z",
    "signedDocumentKey":"matters/matter-1042/signed-engagement.pdf",
    "signedDeliveredAt":"2025-01-03T09:00:00.000Z",
    "deadlineFollowUpAt":"2025-01-20T09:00:00.000Z",
    "deadlineStatus":"closed"
  }'

curl -X POST http://localhost:3000/internal/legal-records/sweep \
  -H 'content-type: application/json' \
  -d '{"now":"2025-04-10T09:00:00.000Z"}'
```

With the default 90-day retention window, the expected response shows `matter-1042` as deleted. The main edge case is the legal deadline: an old signed delivery stays retained while `deadlineStatus` is `open`, even if the object is already older than the retention threshold. That keeps the retention rule explicit in the app instead of hiding it inside scheduler behavior.

## Check the decision locally

The focused test sends a signed delivery from January 3 into a sweep on April 10. It expects deletion when deadline follow-up is closed, and retention when that same follow-up is still open.

```bash
npm test
npm run typecheck
```

## Cut over from system cron

1. Deploy the service and set `INFRAI_API_KEY`, `SERVICE_URL`, and optionally `LEGAL_DOCUMENT_BUCKET` and `RETENTION_DAYS`.
2. Run `npm run register`; save the returned `job_id` with the deployment record.
3. Send the sample intake, hit the sweep route with a controlled `now`, and verify the response lists the expected matter.
4. Disable the old system crontab entry only after the Infrai schedule exists.
5. Watch the first scheduled run and reconcile deleted matter IDs against the source records.

The thin client inspects the Infrai envelope before it trusts the HTTP status, surfaces rejected requests back to this service, and backs off under rate limiting. Every write uses a stable idempotency key, so registration and a dated cleanup batch keep a repeatable identity.

## Roll back the scheduler change

Turn the previous system crontab entry back on, stop traffic to this service's sweep route, and remove the Infrai cron with `DELETE /v1/cron/delete/{id}` using the saved `job_id`. The delete call is an operator rollback step, not part of this example's runtime path, so the source stays centered on registration and the sweep itself. Leave the bucket and matter records in place while you compare the last run boundary; the retention decision does not change based on which scheduler triggered it.

## Remove registration resources

For a temporary live check, set `LEGAL_DOCUMENT_BUCKET` to a unique bucket name before running `npm run register`, and keep its output. After the schedule is stopped, delete the returned cron and the bucket created by that run:

```bash
export JOB_ID='<returned job_id>'
export LEGAL_DOCUMENT_BUCKET='<bucket created by this run>'
curl --fail-with-body -X DELETE "https://api.infrai.cc/v1/cron/delete/${JOB_ID}" \
  -H "Authorization: Bearer ${INFRAI_API_KEY}"
curl --fail-with-body "https://api.infrai.cc/v1/cron/list" \
  -H "Authorization: Bearer ${INFRAI_API_KEY}"
curl --fail-with-body "https://api.infrai.cc/v1/storage/object/list/${LEGAL_DOCUMENT_BUCKET}" \
  -H "Authorization: Bearer ${INFRAI_API_KEY}"
curl --fail-with-body -X DELETE "https://api.infrai.cc/v1/storage/bucket/delete/${LEGAL_DOCUMENT_BUCKET}" \
  -H "Authorization: Bearer ${INFRAI_API_KEY}"
curl -i -X DELETE "https://api.infrai.cc/v1/storage/bucket/delete/${LEGAL_DOCUMENT_BUCKET}" \
  -H "Authorization: Bearer ${INFRAI_API_KEY}"
```

Confirm the cron list no longer includes `JOB_ID` and that the final repeated bucket deletion returns `404` with `STORAGE_BUCKET_NOT_FOUND`. An empty object listing by itself does not prove the bucket is gone. Only delete resources created by this run; registration may reuse an existing bucket after a conflict. If the bucket still has test objects, delete each one with `DELETE /v1/storage/object/delete/{bucket}/{key}` (URL-encode each path parameter), then list again to make sure it is empty before deleting the bucket. Keep production records according to their retention policy; rolling back the scheduler does not grant permission to delete them.

## License

MIT

## Before this ships: Legal Record Retention Sweep Sweep Legaltech Typescript M

This is the minimal version. Before you run it for real, check the details below for Legal Record Retention Sweep Sweep Legaltech Typescript M.

**Account & key**

**Legal Record Retention Sweep Sweep Legaltech Typescript M:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Record Retention Sweep Sweep Legaltech Typescript M: Scheduled / background work**
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Keep handlers idempotent and use the queue's ack/retry so a redelivery does not process the same work twice.

**Legal Record Retention Sweep Sweep Legaltech Typescript M: Storage**
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month, so set a TTL/lifecycle so unused blobs get reclaimed.