import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const Cal = dynamic(() => import('@calcom/embed-react').then((m) => m.default), { ssr: false });

type CalApi = (action: 'ui', payload: { hideEventTypeDetails?: boolean; layout?: 'month_view' | 'week_view' | 'day_view' }) => void;
type GetCalApi = () => Promise<CalApi>;

const LOOM_URL: string = process.env.NEXT_PUBLIC_LOOM_DEMO_URL || 'https://www.loom.com/embed/00000000000000000000000000000000';
const CAL_LINK: string = process.env.NEXT_PUBLIC_CAL_LINK || 'quantumautomations.ai/30min';

export default function Demo() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getCalApi } = await import('@calcom/embed-react');
        const api = (await (getCalApi as GetCalApi)());
        if (!mounted) return;
        api('ui', { hideEventTypeDetails: false, layout: 'month_view' });
        // Mark booking complete when a Cal event is scheduled
        window.addEventListener('message', (evt: MessageEvent) => {
          try {
            const data = evt.data as unknown;
            if (typeof data === 'object' && data && (data as Record<string, unknown>).event && (data as Record<string, unknown>).action === 'bookingSuccessful') {
              if (typeof window !== 'undefined') window.localStorage.setItem('demo:booking-confirmed', '1');
            }
          } catch {}
        });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      {/* Header strip */}
      <div className="w-full border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">Voice AI — Live Demo</div>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to site
          </button>
        </div>
      </div>

      {/* Hero with Loom */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
              <iframe
                src={LOOM_URL}
                title="Live Demo Video"
                frameBorder="0"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Note: This demo shows a generic implementation. Your production setup is customized to your CRM, lead lists, and follow-up workflows.
            </p>
          </div>
          <div className="lg:col-span-2">
            <h1 className="text-2xl md:text-3xl font-bold">See it in action</h1>
            <p className="mt-3 text-slate-700">
              Watch how the AI caller works from Call History: it dials each lead once per day during their local time windows (before work, lunch, after work), captures outcomes, books meetings, and updates the CRM automatically. Agents then focus only on hot leads with meeting-booked or interested outcomes.
            </p>
            <ul className="mt-5 space-y-2 text-slate-700 text-sm">
              <li>• Automated daily call cadence with time-zone awareness</li>
              <li>• Outcomes synced to CRM to pre-qualify lists</li>
              <li>• Agents call back only warm leads with context</li>
              <li>• Custom scripts, DNC compliance, and full audit trail</li>
            </ul>

            <div className="mt-6">
              <a
                href="#book"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-purple-700"
              >
                Book a call →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Calendly embed */}
      <section id="book" className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h2 className="text-xl md:text-2xl font-bold">Pick a time to talk</h2>
          <p className="text-slate-600 mt-1">We’ll walk through how we tailor this to your systems and process.</p>
          <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden" style={{ height: 700 }}>
            <Cal
              namespace="30min-demo"
              calLink={CAL_LINK}
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
              config={{ layout: 'month_view', theme: 'auto' }}
            />
          </div>
          <div className="mt-4 text-sm text-slate-600">
            After booking, you’ll be able to access the live agent test. If you already booked, <a href="/test-calls" className="underline text-blue-700">continue to the test →</a>
          </div>
        </div>
      </section>
    </div>
  );
}

