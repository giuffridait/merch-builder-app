'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#ffffff] text-[#111111]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-10">
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
          <h1 className="text-2xl font-semibold mb-4">Privacy Policy</h1>
          <p className="text-sm text-[#6b6b6b] mb-3">
            This GPT sends user-provided inputs (such as product preferences and shipping country) to a backend API in
            order to generate purchase offers and orders.
          </p>
          <p className="text-sm text-[#6b6b6b] mb-3">
            No data is sold or shared with third parties.
          </p>
          <p className="text-sm text-[#6b6b6b] mb-6">
            This service is for demonstration/testing purposes.
          </p>
          <p className="text-sm text-[#6b6b6b]">
            Contact: <span className="text-[#111111] font-medium">lauragiuffridabarbosa@gmail.com</span>
          </p>
        </div>
      </div>
    </main>
  );
}
