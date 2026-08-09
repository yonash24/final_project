# Chat And WhatsApp Verification

This document records the current verification status for the in-app chat and WhatsApp AI flow, plus the exact manual steps needed to validate both paths in a real environment.

## Current Status

- Code fixes for chat runtime compatibility, WhatsApp webhook idempotency, and outbound reply recovery are merged.
- `npm run test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass locally.
- Gemini API reachability was verified from this environment.
- The configured Supabase host is currently invalid or unavailable: public DNS returned `Status: 3` (`NXDOMAIN`) for `psyfvzbkghfnrhiybpuz.supabase.co`.
- With the current broken Supabase URL:
  - `POST /api/chat` still returns `200` with a safe clarification response
- `POST /api/webhooks/whatsapp/mock-whatsapp` returns `500` with JSON `{ "error": "Webhook processing failed" }`

The Twilio webhook now returns an empty TwiML response after processing so Twilio receives a valid Messaging Webhook response. Configure the Twilio inbound and status callback URL as:

`{APP_BASE_URL}/api/webhooks/whatsapp/twilio-whatsapp`

## Chat-Related Code Paths

- UI: `src/app/chat/page.tsx`
- Chat API: `src/app/api/chat/route.ts`
- Insights logging: `src/app/api/chat/insights/route.ts`
- Chat orchestration: `src/lib/ai/chat-service.ts`
- Intent classification: `src/lib/ai/intent-classifier.ts`
- Semantic search: `src/lib/ai/semantic-search.ts`
- Embeddings: `src/lib/ai/embeddings.ts`
- Activity/event data access: `src/lib/db/chat-queries.ts`

## WhatsApp-Related Code Paths

- Webhook entrypoint: `src/app/api/webhooks/whatsapp/[provider]/route.ts`
- Notification service: `src/lib/notifications/service.ts`
- Provider registry: `src/lib/notifications/provider.ts`
- Mock provider: `src/lib/notifications/providers/mock-whatsapp.ts`
- Twilio provider: `src/lib/notifications/providers/twilio-whatsapp.ts`
- Meta provider: `src/lib/notifications/providers/meta-cloud-api.ts`
- Notification admin APIs:
  - `src/app/api/admin/notifications/settings/route.ts`
  - `src/app/api/admin/notifications/test/route.ts`
  - `src/app/api/notifications/process/route.ts`

## Environment Variables

### Chat

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY`

### WhatsApp

- `APP_BASE_URL`
- `NOTIFICATIONS_CRON_SECRET`

`NOTIFICATIONS_CRON_SECRET` is an application-generated random secret, not a Twilio or Supabase credential. Generate it with a password manager or a command such as `openssl rand -hex 32`, then add the value only to the deployment environment. The scheduled processor accepts it as either `Authorization: Bearer <secret>` or `x-cron-secret: <secret>`. For Vercel Cron, set the same value as `CRON_SECRET` as well, because Vercel sends it as a bearer token.

### Twilio

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `provider_config.twilio_from_number` from admin settings
- `provider_config.twilio_content_sids.*` from admin settings for approved Twilio WhatsApp templates

### Meta

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`
- `META_WHATSAPP_APP_SECRET`
- `provider_config.meta_phone_number_id` from admin settings
- `provider_config.meta_business_account_id` from admin settings

## Database Tables And Migrations

- `chat_sessions` from `supabase/schema.sql`
- `chat_query_logs` from `supabase/migrations/0007_ai_upgrade.sql`
- `notification_settings` from `supabase/migrations/0005_notifications_and_usability.sql`
- `notification_templates` from `supabase/migrations/0005_notifications_and_usability.sql`
- `notification_deliveries` from `supabase/migrations/0005_notifications_and_usability.sql`
- `whatsapp_conversations` from `supabase/migrations/0006_whatsapp_integration.sql`
- `whatsapp_messages` from `supabase/migrations/0006_whatsapp_integration.sql`
- `whatsapp_message_events` from `supabase/migrations/0006_whatsapp_integration.sql`
- `notification_deliveries_idempotency_idx` from `supabase/migrations/0008_notification_delivery_idempotency.sql`

## Required Setup Before Manual Testing

1. Apply all Supabase migrations, including `0008_notification_delivery_idempotency.sql`.
2. Confirm the app can resolve and connect to `NEXT_PUBLIC_SUPABASE_URL`.
3. Confirm `GOOGLE_API_KEY` is valid.
4. In admin settings, choose the WhatsApp provider and save provider-specific config.

## Manual Test: In-App Chat

1. Start the app with `npm run dev`.
2. Open `/chat`.
3. Send a normal query such as `יש אירועים השבוע?`.
4. Confirm the response returns without a server error.
5. Refresh the page and confirm prior messages still appear from local persistence.
6. Send a second contextual question and confirm the chat still responds sensibly.
7. Temporarily break `GOOGLE_API_KEY` and confirm the UI shows a safe assistant error bubble instead of crashing.
8. Restore `GOOGLE_API_KEY`.

## Manual Test: Mock WhatsApp

1. Set provider to `mock-whatsapp` in admin settings.
2. Send a mock inbound webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp/mock-whatsapp \
  -H 'Content-Type: application/json' \
  --data '{"messageId":"mock-e2e-1","from":"+972500000111","profileName":"Webhook Test","text":"יש חוגי מוזיקה?","receivedAt":"2026-07-10T12:00:00.000Z"}'
```

3. Confirm:
   - an inbound row is created in `whatsapp_messages`
   - an outbound reply row is created in `whatsapp_messages`
   - a `received` event is stored in `whatsapp_message_events`
4. Send the exact same payload again.
5. Confirm no second outbound reply is created for the same `messageId`.

## Manual Test: STOP/START Handling

1. Send the same mock webhook with `text` set to `STOP`.
2. Confirm the member opt-in status becomes `opted_out`.
3. Confirm an outbound confirmation reply is sent.
4. Send another normal message and confirm the gated opt-out reply is sent.
5. Send `START`.
6. Confirm the opt-in status becomes `opted_in`.
7. Confirm the AI conversation resumes on the next normal message.

## Manual Test: Twilio

1. Set provider to `twilio-whatsapp`.
2. Configure:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `twilio_from_number`
   - `APP_BASE_URL`
3. Point the Twilio webhook to:
   - `GET/POST {APP_BASE_URL}/api/webhooks/whatsapp/twilio-whatsapp`
4. Send a WhatsApp message from a real device.
5. Confirm:
   - inbound parsing succeeds
   - one outbound AI reply is created
   - delivery status events are recorded
6. Re-deliver the same inbound webhook from Twilio’s console if available.
7. Confirm the duplicate does not create a second outbound reply.

8. Confirm the webhook response has HTTP 200 and `Content-Type: application/xml`, with an empty `<Response></Response>` TwiML body.

9. Confirm Twilio status callbacks update the delivery and message event records for `sent`, `delivered`, `read`, and `failed` states.

10. Deploy with the repository `vercel.json` cron configuration, or configure an external scheduler to POST to `/api/notifications/process?limit=20` every five minutes with the cron secret. Use `/api/admin/notifications/process` for the authenticated admin "run now" action.

## Activity CSV/XLSX Import

The activity importer supports CSV and XLSX files with Hebrew or English headers. It now:

- accepts UTF-8 BOM headers;
- normalizes formatted numeric values such as `₪1,200`;
- normalizes Excel time serials and `HH:mm` values;
- validates Hebrew and English boolean values;
- reports duplicate rows inside one file;
- rejects empty/oversized files and invalid mappings;
- prevents a completed or concurrently processing import job from being committed again.

Run the automated verification with:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Manual Test: Meta Cloud API

1. Set provider to `meta-cloud-api`.
2. Configure:
   - `META_WHATSAPP_ACCESS_TOKEN`
   - `META_WHATSAPP_VERIFY_TOKEN`
   - `META_WHATSAPP_APP_SECRET`
   - `meta_phone_number_id`
   - `meta_business_account_id`
3. Complete Meta webhook verification against:
   - `{APP_BASE_URL}/api/webhooks/whatsapp/meta-cloud-api`
4. Send a real WhatsApp message.
5. Confirm:
   - inbound row creation
   - outbound AI reply creation
   - provider status event creation
6. Re-deliver the same payload if available and confirm duplicate suppression.

## Known External Blocker

During local verification from this environment, direct requests to `NEXT_PUBLIC_SUPABASE_URL` failed with:

- `curl: (6) Could not resolve host`

Public DNS-over-HTTPS verification also returned `NXDOMAIN` for the configured hostname, which means the current Supabase project URL is not resolvable globally, not just from this shell.

Until that DNS or network issue is resolved, full end-to-end verification that depends on Supabase-backed chat search, persistence, and WhatsApp storage cannot be proven from this environment.
