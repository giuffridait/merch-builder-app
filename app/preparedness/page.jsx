'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Info } from 'lucide-react';
import { UCP_CAPABILITIES } from '@/lib/ucp-capabilities';

export default function PreparednessPage() {
  const data = UCP_CAPABILITIES;

  return (
    <main className="min-h-screen bg-[#ffffff] text-[#111111]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-xl" />
            <span className="text-xl font-bold tracking-tight">MerchForge</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-[#111111] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </header>

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          <aside className="bg-white border border-[#e4e4e4] rounded-2xl p-5 h-fit shadow-sm">
            <div className="text-xs text-[#6b6b6b] mb-3">Compliance</div>
            <nav className="space-y-2 text-sm">
              <a href="#overview" className="block text-[#6b6b6b] hover:text-[#111111] transition-colors">
                Overview
              </a>
              <a href="#acp" className="block text-[#6b6b6b] hover:text-[#111111] transition-colors">
                ACP Readiness
              </a>
              <a href="#ucp" className="block text-[#6b6b6b] hover:text-[#111111] transition-colors">
                UCP Readiness
              </a>
              <a href="#capabilities" className="block text-[#6b6b6b] hover:text-[#111111] transition-colors">
                Capabilities
              </a>
            </nav>
          </aside>

          <div className="bg-white border border-[#e4e4e4] rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="text-[#ff6b6b]" />
              <h1 className="text-2xl font-semibold">Commerce Preparedness</h1>
            </div>
            <p id="overview" className="text-[#6b6b6b] mb-6">
              This page summarizes compliance posture for ACP and UCP. It is informational and
              does not represent a live integration.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div id="acp" className="border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
                <h2 className="text-sm font-semibold text-[#ffb14a] mb-3">ACP Readiness</h2>
                <div className="text-sm text-[#6b6b6b] space-y-2">
                  <div>Inventory data matches ACP search + eligibility shape.</div>
                  <div>Filtering and ranking are ACP-field aware.</div>
                  <div>Feed export and hosting are not enabled.</div>
                </div>
                <div className="mt-4 text-xs text-[#6b6b6b]">
                  Source: `data/inventory.acp.json`
                </div>
              </div>

              <div id="ucp" className="border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
                <h2 className="text-sm font-semibold text-[#ffb14a] mb-3">UCP Readiness</h2>
                <div className="text-sm text-[#6b6b6b] space-y-2">
                  <div>Capabilities declared for checkout, shipping, and custom design.</div>
                  <div>Discovery and configuration flows are separated.</div>
                  <div>Cart outputs include currency and delivery estimates.</div>
                </div>
                <div className="mt-4 text-xs text-[#6b6b6b]">
                  Source: `data/ucp-capabilities.json`
                </div>
              </div>
            </div>

            <div id="capabilities" className="mt-8 border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
              <div className="flex items-center gap-2 text-xs text-[#6b6b6b] mb-3">
                <Info size={14} />
                Declared Capabilities
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(data.capabilities).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between bg-white border border-[#e4e4e4] rounded-lg px-3 py-2"
                  >
                    <span className="text-[#6b6b6b]">{key}</span>
                    <span className={value ? 'text-[#7ee07e]' : 'text-[#ff7b7b]'}>
                      {value ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-[#6b6b6b]">
                Supported currencies: {data.supported_currencies.join(', ')} · Countries: {data.supported_countries.join(', ')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
