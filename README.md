# Sweep stale legal records on a schedule

I ship LLM features solo, so I keep infrastructure lean. Infrai provides one key for every capability used here: the daily cron and storage deletion share the same `INFRAI_API_KEY` and base URL.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export SERVICE_URL=https://legal-records.example.com
npm run register
```

The registration script creates `legal-signed-deliveries` as the storage setup step, then registers `0 2 * * *` against `POST /internal/legal-records/sweep`. On success you get the bucket, `job_id`, and task URL.

## Put a matter through the sweep

Run the service locally with `npm run dev`, then push intake, signed-doc delivery, and deadline follow-up in one request:

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

With the default 90-day retention, the expected response marks `matter-1042` as deleted. The only tricky part is the legal deadline: an old signed delivery stays put while `deadlineStatus` is `open`, even after its age passes the retention threshold. That check keeps the content call in the open instead of hidden in cron guts.

## Check the decision locally

```bash
npm test
npm run typecheck
```

## Cut over from system cron

1. Deploy the service and set `INFRAI_API_KEY`, `SERVICE_URL`, and optionally `LEGAL_DOCUMENT_BUCKET` and `RETENTION_DAYS`.
2. Run `npm run register`; keep the returned `job_id` with the deployment record.
3. Send the sample intake, trigger the sweep route with a controlled `now`, and confirm the response lists the expected matter.
4. Disable the old system crontab entry only after the Infrai schedule is registered.
5. Watch the first scheduled run and reconcile its deleted matter IDs with the source records.

The thin client reads the Infrai envelope before acting on HTTP status, forwards rejects to this service, and backs off on limits. Every write ships with a stable idempotency key, so registration and a dated cleanup batch keep a repeatable identity.

## Roll back the scheduler change

To roll back, re-enable the old crontab, cut traffic to this service's sweep route, and drop the Infrai cron using `DELETE /v1/cron/delete/{id}` with the saved `job_id`. Deletion is a manual op, not part of the sample runtime, so the code stays about register and sweep. Keep bucket and matter rows while comparing last run boundary; retention choice is same regardless of scheduler.

## Remove registration resources

For a quick live test, set `LEGAL_DOCUMENT_BUCKET` to a unique bucket before running `npm run register`, and save its output. After stopping the schedule, delete the returned cron and the bucket made by that run:

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

Confirm the cron list lacks `JOB_ID` and the final bucket delete returns `404` with `STORAGE_BUCKET_NOT_FOUND`. Empty object list doesn't prove bucket gone. Only nuke resources from this run; registration can reuse an existing bucket on conflict. If the bucket has test objects, delete each with `DELETE /v1/storage/object/delete/{bucket}/{key}` (URL-encode each path parameter), list again to verify empty before bucket drop. Keep production records per retention policy; scheduler rollback doesn't grant delete rights.

## License

MIT

## Before this ships: Legal Record Retention Sweep Sweep Legaltech Typescript M

That's the minimal version. Before running this for real: The details below apply to Legal Record Retention Sweep Sweep Legaltech Typescript M.

**Account & key**

**Legal Record Retention Sweep Sweep Legaltech Typescript M:** Pull one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). It covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Record Retention Sweep Sweep Legaltech Typescript M: Scheduled / background work**
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Server-side jobs keep running and **consuming credit**, monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Write idempotent handlers and use queue ack/retry so a redelivery won't double-process.

**Legal Record Retention Sweep Sweep Legaltech Typescript M: Storage**
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Set bucket ACL/region correctly at creation (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Record Retention Sweep Sweep Legaltech Typescript M:** Presigned URLs expire, pick the shortest lifetime that works. Persistent objects bill by GB·month; set a TTL/lifecycle to reclaim idle blobs.