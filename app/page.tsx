import Link from 'next/link';
import { Sparkles, PackageSearch } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#ffffff] text-[#111111]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-xl" />
            <span className="text-2xl font-bold tracking-tight">MerchForge</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Choose Your Journey
          </h1>
          <p className="text-[#6b6b6b] max-w-2xl">
            Two guided flows, each with an AI companion. Start with inventory discovery,
            or jump straight into customization.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#e4e4e4] rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <PackageSearch className="text-[#e4002b]" />
              <h2 className="text-xl font-semibold">Inventory Companion</h2>
            </div>
            <p className="text-[#6b6b6b] mb-6">
              Tell the assistant who it’s for and the vibe you want. It will narrow down
              the best product options before you customize.
            </p>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-semibold text-white"
            >
              Start Inventory Flow
            </Link>
          </div>

          <div className="bg-white border border-[#e4e4e4] rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="text-[#ff6b6b]" />
              <h2 className="text-xl font-semibold">Customization Companion</h2>
            </div>
            <p className="text-[#6b6b6b] mb-6">
              Already know what you want? Jump into the guided customization flow and
              generate designs instantly.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-semibold"
            >
              Start Customization Flow
            </Link>
          </div>
        </div>

        <div className="mt-10">
            <Link
              href="/preparedness"
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-[#e4e4e4] text-[#6b6b6b] hover:text-[#111111] hover:bg-[#f7f7f7] transition-all text-sm"
            >
              View ACP/UCP Preparedness
            </Link>
        </div>
      </div>
    </main>
  );
}
