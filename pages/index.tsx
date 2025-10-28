import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  AnalyticsCharts,
  PieChartComponent,
} from "../components/charts/AnalyticsCharts";
import { getAnalyticsData } from "../data/centralData";
import { ABVariant, getVariant, setVariant } from "../lib/ab";

const Landing: React.FC = () => {
  const router = useRouter();
  const [showSuggest, setShowSuggest] = useState(false);
  const [variant, setVariantState] = useState<ABVariant>("A");
  const analyticsData = getAnalyticsData();

  useEffect(() => {
    // Determine A/B variant from query, then cookie, fallback random
    try {
      const q = router.query.ab;
      const qv = typeof q === "string" ? q.toUpperCase() : undefined;
      if (qv === "A" || qv === "B") {
        setVariant(qv);
        setVariantState(qv);
        return;
      }
    } catch {}
    try {
      const v = getVariant();
      setVariantState(v);
    } catch {}
  }, [router.query.ab]);

  useEffect(() => {
    // Suggest modal after delay; don't nag if already seen
    try {
      const seen =
        typeof window !== "undefined"
          ? localStorage.getItem("landingSuggestSeen")
          : "1";
      if (!seen) {
        const t = setTimeout(() => setShowSuggest(true), 10000);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSuggest(false);
    };
    if (showSuggest) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showSuggest]);

  const goPrimary = () => {
    try {
      localStorage.setItem("landingSuggestSeen", "1");
    } catch {}
    if (variant === "B") router.push("/dashboard");
    else router.push("/test-calls");
  };

  const dismissSuggest = () => {
    try {
      localStorage.setItem("landingSuggestSeen", "1");
    } catch {}
    setShowSuggest(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pt-28 pb-10">
          <div className="flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/60 backdrop-blur px-2.5 py-0.5 text-xs text-slate-600 w-fit mx-auto">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Reactivation + Speed to Lead
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-extrabold tracking-tight text-center leading-[1.05]">
            Turn cold databases into hot pipeline in{" "}
            <span className="inline-block align-baseline px-3 py-0.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              minutes
            </span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-slate-600 max-w-3xl mx-auto text-center">
            Respond to every lead in under a minute, 24/7. Our AI calls,
            qualifies, books, and updates your CRM so reps spend time with
            buyers ready to move. Predictable pipeline, fewer wasted ad dollars,
            standardized qualification without hiring.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={goPrimary}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white px-5 py-3 text-base font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-purple-700"
            >
              {variant === "B" ? "Open Dashboard →" : "Open Dashboard →"}
            </button>
          </div>

          {/* Decision-maker badges (smaller) */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {[
              "Under-1-minute response, 24/7, across lead sources",
              "Standardized BANT capture + instant CRM updates",
              "Appointments booked automatically; fewer no-shows",
              "Predictable pipeline lift without headcount",
            ].map((t, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white/70 backdrop-blur px-3.5 py-2.5 text-sm text-slate-700 text-center"
              >
                {t}
              </div>
            ))}
          </div>

          <p className="mt-8 text-slate-500 text-xs text-center">
            Also see HBR:{" "}
            <a
              className="underline text-blue-600 hover:text-blue-700"
              // href="https://hbr.org/2011/03/the-short-life-of-online-sales-leads"
              href="#"
              target="_blank"
              rel="noreferrer"
            >
              The Short Life of Online Sales Leads
            </a>
          </p>

          {/* Scroll hint */}
          <div className="mt-2 text-center text-slate-400 text-sm">
            Scroll to see the data ↓
          </div>
        </div>
      </section>

      {/* Stats section (moved from hero) */}
      <section className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 backdrop-blur p-6 border border-slate-200 text-center">
              <div className="h-24 md:h-28 flex flex-col items-center justify-center">
                <p className="text-4xl font-extrabold leading-none">
                  <span className="inline-block px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    8×
                  </span>
                </p>
                <p className="text-slate-700 text-base mt-1">
                  higher conversion in the first 5 minutes
                </p>
              </div>
              <a
                className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 underline"
                // href="https://www.insidesales.com/response-time-matters/"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                InsideSales 2021
              </a>
            </div>
            <div className="rounded-2xl bg-white/80 backdrop-blur p-6 border border-slate-200 text-center">
              <div className="h-24 md:h-28 flex flex-col items-center justify-center">
                <p className="text-4xl font-extrabold leading-none">
                  <span className="inline-block px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    100× / 21×
                  </span>
                </p>
                <p className="text-slate-700 text-base mt-1">
                  better contact/qualification vs 30 minutes
                </p>
              </div>
              <a
                className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 underline"
                // href="https://cdn2.hubspot.net/hub/25649/file-13535879-pdf/docs/mit_study.pdf"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                MIT/InsideSales
              </a>
            </div>
            <div className="rounded-2xl bg-white/80 backdrop-blur p-6 border border-slate-200 text-center">
              <div className="h-24 md:h-28 flex flex-col items-center justify-center">
                <p className="text-4xl font-extrabold leading-none">
                  <span className="inline-block px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    35%
                  </span>
                </p>
                <p className="text-slate-700 text-sm mt-1">lift</p>
                <p className="text-slate-700 text-base mt-1">
                  AI voice callers vs. manual cold calling
                </p>
              </div>
              <a
                className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 underline"
                /* href="https://dasha.ai/en-us/blog/case-studies-successful-implementations-of-voice-ai-in-cold-calling" */
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                Dasha case study (2024)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Speed to lead narrative WITH bar chart side-by-side */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 p-4">
              <div className="h-80">
                <AnalyticsCharts data={analyticsData} />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-2xl md:text-3xl font-bold">
                Be first to every lead, day or night
              </h2>
              <ul className="mt-6 space-y-3 text-slate-700">
                <li>Respond in &lt;60s, 24/7; capture, qualify, and book.</li>
                <li>After-hours conversions +40–60%; win weekends.</li>
                <li>
                  Conversion lifts from 1.5% → 3–5%; response time 47h → &lt;1m.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - colorful tiles without emojis */}
      <section className="border-t border-slate-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                color: "from-blue-50 to-blue-100",
                title: "Connect CRM",
                desc: "Sync leads and DNC lists automatically.",
              },
              {
                color: "from-emerald-50 to-emerald-100",
                title: "Enrich & score",
                desc: "Fill profiles, score intent and recency.",
              },
              {
                color: "from-amber-50 to-amber-100",
                title: "Smart scheduling",
                desc: "Time zones, cooldowns, routing rules.",
              },
              {
                color: "from-purple-50 to-purple-100",
                title: "AI calls & books",
                desc: "Natural calls, BANT capture, bookings.",
              },
              {
                color: "from-pink-50 to-pink-100",
                title: "Sync & analytics",
                desc: "Notes, recordings, live dashboards.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`rounded-xl border border-slate-200 bg-gradient-to-br ${card.color} p-5`}
              >
                <div className="mt-1 font-semibold text-slate-900 text-sm">
                  {card.title}
                </div>
                <div className="mt-2 text-xs text-slate-700">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Persona value */}
      <section className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold">Why teams use this</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { h: "Executives", p: "Predictable pipeline without headcount." },
              {
                h: "Sales leaders",
                p: "Higher connection rates, fewer no-shows, cleaner CRM.",
              },
              {
                h: "Operations",
                p: "DNC, audit trail, standard scripts, fewer manual tasks.",
              },
              {
                h: "Marketing",
                p: "Protect ad spend with instant response & consistent nurture.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white/70 backdrop-blur px-4 py-6"
              >
                <p className="font-semibold text-slate-900">{card.h}</p>
                <p className="mt-2 text-sm text-slate-700">{card.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reactivation proof WITH pie chart side-by-side */}
      <section className="border-t border-slate-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">
                Find hidden pipeline in your CRM
              </h2>
              <ul className="mt-6 space-y-3 text-slate-700">
                <li>
                  Mine dormant and duplicate records to{" "}
                  <strong>unlock revenue fast</strong> without new spend.
                </li>
                <li>
                  Use intent + recency to{" "}
                  <strong>prioritize high-probability callbacks</strong> and
                  reduce CAC.
                </li>
                <li>
                  Proof it works: 738% ROI reactivation case (MarketingSherpa);
                  400% lift with personalization; 8% win-back in list cleanse
                  (MarketingSherpa).
                </li>
              </ul>
              <div className="mt-8">
                <button
                  onClick={goPrimary}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white px-5 py-3 font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-purple-700"
                >
                  {variant === "B" ? "Open Dashboard →" : "Open Dashboard →"}
                </button>
              </div>
            </div>
            <div className="rounded-2xl bg-white/70 backdrop-blur border border-slate-200 p-4">
              <div className="h-80">
                <PieChartComponent data={analyticsData} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold">FAQs</h2>
          <div className="mt-8 space-y-3">
            {[
              {
                q: "We already have ISAs.",
                a: "Augment them - AI covers low/medium leads and off-hours; ISAs focus on the hottest conversations.",
              },
              {
                q: "Will we lose the personal touch?",
                a: "No. AI qualifies and books; your agents do the human conversations. Voices are natural and brand-tuned.",
              },
              {
                q: "Compliance?",
                a: "DNC/opt-out/cooldowns enforced with audit trail; GDPR/TCPA aligned. You control rules and scripts.",
              },
              {
                q: "Cost justification?",
                a: "Calls are ~$0.07/call. One extra closing per month often pays for the platform.",
              },
              {
                q: "What happens when I click the primary CTA?",
                a: "You’ll either see the live demo video with booking, or jump straight into the dashboard demo — no signup needed.",
              },
              {
                q: "Do I need to integrate anything first?",
                a: "Not for the demo. In production, connect your CRM and calendars - then go live.",
              },
            ].map((item, idx) => (
              <details
                key={idx}
                className="group rounded-2xl bg-white/70 backdrop-blur border border-slate-200 p-4"
              >
                <summary className="list-none cursor-pointer select-none flex items-center justify-between">
                  <span className="font-medium text-slate-900">{item.q}</span>
                  <span className="ml-4 text-slate-500 group-open:rotate-180 transition-transform">
                    ⌄
                  </span>
                </summary>
                <div className="mt-3 text-slate-700">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-slate-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-white text-center">
            <h3 className="text-2xl font-bold">
              Pilot in 90 days. Prove the lift.
            </h3>
            <p className="mt-2 opacity-90">
              Agree success metrics - connection rate, appointments booked,
              show-up rate - and see the impact on your leads.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={goPrimary}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:from-blue-700 hover:to-purple-700"
              >
                {variant === "B" ? "Open Dashboard →" : "Open Dashboard →"}
              </button>
              <button
                onClick={() => router.push("/test-calls")}
                className="px-6 py-3 rounded-xl border border-slate-300 bg-white/60 text-slate-700 hover:bg-white"
              >
                Explore dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Suggestion Modal */}
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={dismissSuggest}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-suggest-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-6 shadow-xl"
          >
            <h3
              id="dash-suggest-title"
              className="text-xl font-semibold text-slate-900"
            >
              Ready to see the live dashboard?
            </h3>
            <p className="mt-2 text-slate-600">
              Jump into analytics now - or keep exploring and open it later.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={goPrimary}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 font-semibold hover:from-blue-600 hover:to-purple-700"
              >
                {variant === "B" ? "See demo live →" : "Try voice agent →"}
              </button>
              <button
                onClick={dismissSuggest}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
