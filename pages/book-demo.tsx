import React, { useEffect } from 'react';
import Layout from '../components/layout/Layout';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Link from 'next/link';

const Cal = dynamic(() => import('@calcom/embed-react').then(m => m.default), { ssr: false });
const getCalApi = dynamic(() => import('@calcom/embed-react').then(m => m.getCalApi as any), { ssr: false });

export default function BookDemo() {
  const router = useRouter();
  const name = typeof router.query.name === 'string' ? router.query.name : '';
  const email = typeof router.query.email === 'string' ? router.query.email : '';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const api: any = await (getCalApi as unknown as () => Promise<any>)();
        if (!mounted || !api) return;
        api('ui', { hideEventTypeDetails: false, layout: 'month_view' });
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Book a Demo</h1>
          <p className="text-slate-600">Pick a time that works best for you.</p>
        </div>

        {/* Segmented control to navigate between Test Calls and Book Demo */}
        <div className="flex gap-2">
          <Link href="/test-calls" className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50">
            Web Call Test
          </Link>
          <Link href="/book-demo" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800">
            Book Demo
          </Link>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden" style={{ height: 700 }}>
          <Cal
            namespace="30min"
            calLink="asadullah01/30min"
            style={{ width: '100%', height: '100%', overflow: 'auto' }}
            config={{ layout: 'month_view', theme: 'auto', name, email }}
          />
        </div>
      </div>
    </Layout>
  );
}


