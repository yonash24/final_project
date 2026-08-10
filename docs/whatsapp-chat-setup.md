# WhatsApp chatbot setup

The application already sends an inbound WhatsApp message to the same
`getChatResponse` flow used by the web chat. To make it answer real WhatsApp
messages:

1. Apply all Supabase migrations, including `0012_category_deduplication.sql`.
2. Set `GOOGLE_API_KEY` in the server environment. The chatbot uses Gemini for
   intent classification and answer generation.
3. Seed the knowledge base and embeddings with
   `npx tsx src/scripts/seed-knowledge-and-embeddings.ts`. Re-run it after
   changing FAQs, policies, opening hours, or contact information.
4. In Admin → Settings, select `Meta Cloud API` and enter the Meta phone number
   ID and WhatsApp Business account ID.
5. Set these server environment variables:
   `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_VERIFY_TOKEN`, and
   `META_WHATSAPP_APP_SECRET`. Also set `APP_BASE_URL` to the public HTTPS
   origin of the deployed app. `META_GRAPH_API_VERSION` is optional and
   defaults to `v23.0`.
6. In Meta, configure the callback URL
   `https://YOUR-DOMAIN/api/webhooks/whatsapp/meta-cloud-api`, use the same
   verify token, and subscribe the app to the `messages` webhook field.
7. Deploy with a public HTTPS URL. Test by sending `START`, then a normal
   Hebrew question. Check Admin → Settings → recent deliveries and server
   logs if a reply is not delivered.

For scheduled confirmations, reminders, and change notifications, create an
approved Meta template for each enabled notification type. In Admin → Settings
enter each exact Meta template name and its language code (for example `he`).
The importer maps the saved template variables to Meta body parameters. If a
template name is missing, that delivery fails clearly instead of sending an
invalid free-form message outside the customer-service window.

For Meta's WhatsApp rules, free-form replies are normally allowed inside the
customer-service window after an inbound message. Business-initiated messages
outside that window require an approved WhatsApp template. The chatbot reply
itself is free-form and is sent in response to the inbound question.
