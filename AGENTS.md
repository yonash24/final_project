<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This repo uses a newer Next.js layout and API surface than older training data. Before changing app code, read the relevant docs in `node_modules/next/dist/docs/` and follow any deprecation notices.
<!-- END:nextjs-agent-rules -->

# Codex Working Rules

## Goal
- Make the smallest correct change.
- Prefer clarity, safety, and maintainability over cleverness.
- Use the fewest tokens possible while still being accurate and complete.

## Before Editing
- Inspect the existing code path first.
- Prefer `rg` and `rg --files` for discovery.
- Read only the files needed for the task.
- Check `git status` before touching anything.
- If the task depends on framework behavior, read the local docs first.

## How To Work
- Make one focused change at a time.
- Use `apply_patch` for all manual edits.
- Keep edits ASCII unless the file already uses other characters.
- Preserve user changes; never revert unrelated work.
- Do not use destructive commands unless explicitly requested.
- If a change has tradeoffs, choose the safer default and state the assumption briefly.

## Token-Efficient Workflow
- Batch related reads in parallel when possible.
- Do not re-read large files unless the context changed.
- Summarize results instead of dumping raw output.
- Avoid long explanations unless the user asked for them.
- Reuse existing helpers, patterns, and types instead of creating new ones.

## Validation
- After code changes, run the smallest useful test or lint command.
- If tests cannot run, say why clearly.
- Prefer targeted tests over full-suite runs when possible.
- Verify the affected route, component, or utility directly.

## Next.js / App Router
- Follow local app-router conventions in this repo.
- Check server/client boundaries before adding state or side effects.
- Keep route handlers small and deterministic.
- Prefer server-side enforcement for auth and access control.

## Auth and Security
- Never treat client-side UI as security.
- Enforce authentication and authorization on the server.
- Use role-based access checks for admin features.
- Use database RLS where possible.
- Log security-sensitive actions.

## Chat and AI Work
- Keep the hot path short.
- Avoid unnecessary model calls.
- Use structured retrieval before free-form generation.
- Reduce prompt size and history length when possible.
- Prefer cached or precomputed data over runtime work.
- Measure latency at each stage before optimizing further.

## Database and API Work
- Keep queries narrow and indexed.
- Return only fields the caller needs.
- Handle empty results and errors explicitly.
- Use background or fire-and-forget work for non-critical analytics.

## Final Response
- State what changed first.
- Mention files changed with absolute paths when helpful.
- Note validation you ran.
- Call out any residual risk or follow-up work briefly.
