AB Test: Demo CTA vs Voice Agent

Overview
- Variant A: Current experience. Primary CTA labeled "Try voice agent →" linking to `/test-calls` (live dashboard demo).
- Variant B: Conversion-focused experience. Primary CTA labeled "See demo live →" linking to `/demo` (Loom video + Calendly on same page).

Assignment
- Visitors are assigned 50/50 on first visit and persisted in a cookie `ab_test_variant` for 14 days.
- Override by appending `?ab=A` or `?ab=B` to any page URL. This sets the cookie and updates the session immediately.

Netlify setup (branches and split test)
- Create two branches in GitHub:
  - `ab-A` (control): keep current experience. Optionally set env `NEXT_PUBLIC_FORCE_AB=A` in Netlify for this branch deploy.
  - `ab-B` (variant): includes `/demo` page and CTA routing. Optionally set env `NEXT_PUBLIC_FORCE_AB=B` for this branch deploy.
- In Netlify, enable Branch Deploys for both branches. Each will get its own URL.
- To split traffic on production domain, use Netlify Split Testing:
  1) In the site dashboard → Split Testing → Create test
  2) Add branches `ab-A` and `ab-B` at 50/50 (or desired ratio)
  3) Start test. Netlify will route users consistently (sticky) across visits.
- Alternative (no Split Testing): run both branches as branch deploys and direct traffic from email campaigns to the desired variant URL with `?ab=A|B` query and rely on our cookie stickiness.

Environment variables
- `NEXT_PUBLIC_FORCE_AB`: Optional. When set to `A` or `B`, forces that variant globally and sets the cookie. Useful for per-branch forcing or QA.
- `NEXT_PUBLIC_LOOM_DEMO_URL`: Full Loom embed URL.
- `NEXT_PUBLIC_CAL_LINK`: Cal.com link slug (e.g., `quantumautomations.ai/30min`).

Demo Page
- Path: `/demo`
- Environment:
  - `NEXT_PUBLIC_LOOM_DEMO_URL` (optional): full Loom embed URL. Example: `https://www.loom.com/embed/VIDEO_ID?hide_owner=true&hide_share=true`.
  - `NEXT_PUBLIC_CAL_LINK` (optional): Cal.com link slug. Defaults to `quantumautomations.ai/30min`.
- Content: Large Loom video focused on Call History + copy about daily call windows (pre-work, lunch, after-work), CRM updates, and CTA to book on the same page.

Places changed
- `pages/index.tsx`: Primary CTA label and target route now depend on the assigned variant; FAQ updated accordingly. The final CTA uses the same logic.
- `lib/ab.ts`: Cookie utilities for variant selection.
- `pages/demo.tsx`: New page with Loom + Calendly embed and messaging tailored for real estate workflows.

How to QA
- Open `/` and check console cookies for `ab_test_variant`.
- Force A: `/??ab=A` → CTA shows "Try voice agent →" and routes to `/test-calls`.
- Force B: `/??ab=B` → CTA shows "See demo live →" and routes to `/demo`.
- On `/demo`, verify Loom loads and the booking embed renders.

Notes
- Email templates should link to the main site with the button copy matching the target variant (for B: "See Demo Live") and include a second link to book a call. The on-site demo page reinforces that production is tailored to the client’s CRM and workflows.

