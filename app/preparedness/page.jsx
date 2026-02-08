'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
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

        <div className="bg-white border border-[#e4e4e4] rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="text-[#ff6b6b]" />
            <h1 className="text-2xl font-semibold">Commerce Preparedness</h1>
          </div>
          <p className="text-[#6b6b6b] mb-6">
            Overview of ACP/UCP readiness. This is informational and does not represent a live integration.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
              <h2 className="text-sm font-semibold text-[#ffb14a] mb-3">ACP — Available Now</h2>
              <ul className="text-sm text-[#6b6b6b] space-y-2">
                <li>Inventory data matches ACP search + eligibility shape.</li>
                <li>Filtering and ranking use ACP fields.</li>
              </ul>
              <div className="mt-4 text-xs text-[#6b6b6b]">
                Source: `data/inventory.acp.json`
              </div>
            </div>

            <div className="border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
              <h2 className="text-sm font-semibold text-[#ffb14a] mb-3">UCP — Available Now</h2>
              <ul className="text-sm text-[#6b6b6b] space-y-2">
                <li>Capabilities declared for checkout, shipping, and custom design.</li>
                <li>Discovery and configuration flows are separated.</li>
                <li>Cart output includes currency and delivery estimate.</li>
              </ul>
              <div className="mt-4 text-xs text-[#6b6b6b]">
                Source: `data/ucp-capabilities.json`
              </div>
            </div>
          </div>

          <div className="mt-8 border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
            <h3 className="text-sm font-semibold text-[#6b6b6b] mb-3">Agentic Workflow & Prompts</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="text-sm text-[#6b6b6b] space-y-3">
                <h4 className="font-medium text-[#111111]">State Machine (React + Streaming API)</h4>
                <p>The conversation is managed by a state machine with the following stages:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['welcome', 'product', 'intent', 'text', 'icon', 'preview'].map(stage => (
                    <span key={stage} className="px-2 py-1 bg-white border border-[#e4e4e4] rounded-md">{stage}</span>
                  ))}
                </div>
                <p>
                  User input is sent to a streaming endpoint (<code>/api/create</code>), which provides Server-Sent Events (SSE) for a real-time, per-chunk chat experience.
                </p>
                <p>
                  The API returns JSON updates for the state (e.g., changing colors) and a text delta for the message content.
                </p>
              </div>

              <div className="text-sm text-[#6b6b6b] space-y-3">
                <h4 className="font-medium text-[#111111]">System Prompt Highlights</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Persona:</strong> "Friendly, confident merch design assistant."</li>
                  <li><strong>Output:</strong> Strict JSON format for state updates.</li>
                  <li><strong>Constraints:</strong> Enforces valid colors, vibes, occasions, and text length.</li>
                  <li><strong>Logic:</strong> Decides the next stage based on missing information.</li>
                  <li><strong>Fuzzy Parsing:</strong> Robust keyword-based extraction of product, color, and size.</li>
                  <li><strong>Fallback:</strong> Automatically switches to deterministic keyword matching if the LLM is unavailable.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 border border-[#e4e4e4] rounded-xl p-6 bg-[#f7f7f7]">
            <h3 className="text-sm font-semibold text-[#6b6b6b] mb-3">Available Capabilities</h3>
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
    </main>
  );
}
