# Publuu Import Verification

This document records the current status of the Publuu digital-booklet import path and the manual steps required to validate it end to end.

## Background

Publuu does not offer a public developer API (verified against their public help center and marketing pages — no API docs, no API key mechanism exist as of writing). The supported integration is therefore the official-PDF-download path: every Publuu flip-book has a built-in "download PDF" feature (on by default, can be disabled by the book owner), and this app downloads that PDF directly and feeds it through the same document-extraction pipeline already used for uploaded Word/PDF files. This matches the spec's guidance to "use whatever the service provides" rather than requiring a general external-API integration.

## Code Paths

- Upload UI: `src/app/admin/classes/import/page.tsx`
- Preview API (accepts a Publuu PDF URL or an uploaded file): `src/app/api/admin/activity-import/preview/route.ts`
- Commit API: `src/app/api/admin/activity-import/commit/route.ts`
- Publuu URL validation and PDF download: `src/lib/admin/publuu.ts` (`isPubluuHost`, `fetchOfficialPubluuPdf`)
- Document extraction (shared with Word/PDF uploads): `src/lib/admin/activity-import.ts` (`parseActivityDocument`)
- DB tables: `import_sources` (`source_type = 'publuu'`, `publuu_url`), `source_revisions`, `import_jobs`, `import_rows`, `import_evidence`, and field-level provenance — see migrations `0018_safe_activity_management.sql` through `0021_activity_safety_boundary.sql`

## Automated Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`src/lib/admin/__tests__/publuu.test.ts` covers: host allowlisting, redirect-chain handling (including rejecting a chain longer than 3 hops), rejecting non-PDF responses, rejecting oversized files, and surfacing a clear error on a non-2xx response. These tests mock `fetch` and do not require network access or a real Publuu account.

## What Cannot Be Verified Without a Real Publuu Account

The automated tests only prove the code behaves correctly against a *simulated* Publuu response. They cannot prove:

- that a real Publuu "download PDF" link actually resolves under the `*.publuu.com` host pattern `isPubluuHost` expects (the download may be served from a different subdomain or CDN — this needs confirming against a real link);
- that the extraction step correctly reads activities out of a real Publuu-generated PDF (font/layout quirks of Publuu's PDF export are unknown until tested);
- the full pipeline end to end (Publuu → download → extraction → admin preview/approval → central store → chat bot answering from stored data, not re-reading Publuu).

## Manual Test: Publuu End-to-End

1. Create a free/trial account at publuu.com.
2. Prepare a small test PDF (2-3 pages) containing 2-3 sample activities with clear fields: name, age range, day, time, branch.
3. Upload the PDF to Publuu and publish it as a digital flip-book.
4. Confirm the "Download PDF" option is enabled (Publuu: CUSTOMIZE → MENU → DOWNLOAD PDF toggle).
5. Open the published flip-book, click the download button, and copy the resulting URL (check the browser's network tab if the link isn't directly visible — it may trigger a download rather than navigate).
6. Confirm the copied URL's host matches `*.publuu.com` per `isPubluuHost` in `src/lib/admin/publuu.ts`. If it does not, the allowlist in that file needs to be updated to include the actual host before this flow will work — this is expected to require a source change once a real link is available.
7. Start the app (`npm run dev`), open `/admin/classes/import`.
8. Paste the flip-book viewer URL into the "קישור Publuu" field and the download URL into the "קישור PDF רשמי" field. A manually downloaded PDF can be uploaded through the same screen as a fallback.
9. Proceed through the wizard (upload/inspect → mapping → preview → commit) and confirm:
   - the activities from the test PDF are extracted correctly;
   - any field intentionally left out of the test PDF (e.g. no listed price) shows up as missing/blank in the preview, not guessed;
   - nothing is written to the database until rows are explicitly approved and "אשר ייבוא" is clicked.
10. Open `/chat` and ask a question that should match one of the test activities (e.g. by age/day/branch). Confirm the bot answers correctly from the stored data.
11. Temporarily stop the app or disconnect from Publuu, and confirm the same chat question still answers correctly — proving the bot queries the central store, not Publuu, on every question.

## Known Limitation

Because Publuu has no public API, this integration depends on the "download PDF" feature remaining enabled and predictably reachable. If a future Publuu account/plan disables or changes this feature, the import will need a different capture path (e.g. an admin manually downloading the PDF from Publuu and uploading it directly through the existing file-upload field, which already works today).
