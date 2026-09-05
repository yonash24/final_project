# WhatsApp chatbot setup

The application already sends an inbound WhatsApp message to the same
`getChatResponse` flow used by the web chat. To make it answer real WhatsApp
messages:

1. Apply all Supabase migrations through `0021_activity_safety_boundary.sql`.
2. Set `GOOGLE_API_KEY` in the server environment. The chatbot uses Gemini for
   intent classification and answer generation.
3. Seed the knowledge base and embeddings with
   `npx tsx src/scripts/seed-knowledge-and-embeddings.ts`. Re-run it after
   changing FAQs, policies, opening hours, or contact information.
4. In Admin → Settings, select `Twilio WhatsApp`, enable notifications, and
   enter the Twilio sender as `whatsapp:+E164_NUMBER`. Leave `mock-whatsapp`
   selected until credentials and the sandbox test are complete.
5. Set these server environment variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY`, `APP_BASE_URL`,
   `NOTIFICATIONS_CRON_SECRET` (or `CRON_SECRET`), `TWILIO_ACCOUNT_SID`, and
   `TWILIO_AUTH_TOKEN`.
6. In Twilio Console → Sandbox, set the exact webhook URL
   `https://YOUR-DOMAIN/api/webhooks/whatsapp/twilio-whatsapp` for incoming
   messages and status callbacks. Test users must first send the Sandbox
   `join <code>` message.
7. Deploy with a public HTTPS URL. Test by sending `START`, then a normal
   Hebrew question. Check Admin → Settings → recent deliveries and server
   logs if a reply is not delivered.

## Linked administrator flow

An inbound phone number has no management permission by itself. Sign in to the
website as an administrator, open Admin → Settings, and explicitly link the
E.164 WhatsApp number to either Twilio or Meta. A linked administrator can send
a create/update/archive instruction and receives a six-digit, ten-minute
confirmation code. The change is executed only after the same linked identity
sends that code; the code is single-use and the activity version is checked
again before execution.

Linked administrators may also send CSV, XLSX, DOC, DOCX, or PDF documents (up
to 25 MB). The file is staged in the normal import pipeline and WhatsApp returns
a website review link. The administrator must review conflicts and explicitly
approve rows on the website before anything is published. For Meta, configure
the existing bearer token; for Twilio, configure the account SID and auth token
so the server can download provider-hosted media.

For scheduled confirmations, reminders, and change notifications, create an
approved Twilio Content Template and enter each exact `ContentSid` in Admin →
Settings. The importer maps saved template variables to `ContentVariables`.
If a Content SID is missing, that delivery fails clearly instead of sending an
invalid free-form message outside the customer-service window.

For WhatsApp's rules, free-form replies are normally allowed inside the
customer-service window after an inbound message. Business-initiated messages
outside the 24-hour window require an approved template. The chatbot reply
itself is free-form and is sent in response to the inbound question. Verify one
duplicate webhook (same provider message ID), then one `delivered` status
callback, and confirm only one reply and one event are recorded. Apply all
migrations and seed RAG with `npx tsx src/scripts/seed-knowledge-and-embeddings.ts`.

Meta remains available at
`https://YOUR-DOMAIN/api/webhooks/whatsapp/meta-cloud-api`; configure its
existing access token, verify token, app secret, phone number ID, and optional
`META_GRAPH_API_VERSION` values when selecting `Meta Cloud API` in Admin →
Settings.
