'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { getContrastColor, DesignVariant } from '@/lib/design';

interface DesignPickerProps {
  designs: DesignVariant[] | null;
  selectedVariant: string | null;
  onSelect: (id: string) => void;
  selectedColorHex: string;
  loading?: boolean;
}

export default function DesignPicker({ designs, selectedVariant, onSelect, selectedColorHex, loading }: DesignPickerProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <h3 className="text-sm font-medium text-[#6b6b6b]">DESIGN VARIANTS</h3>
        <div className="flex items-center gap-2 py-8 justify-center text-[#6b6b6b]">
          <Loader2 size={20} className="animate-spin text-[#e4002b]" />
          <span className="text-sm">AI is designing your layouts...</span>
        </div>
      </div>
    );
  }

  if (!designs) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      <h3 className="text-sm font-medium text-[#6b6b6b]">DESIGN VARIANTS</h3>
      <div className="text-xs text-[#6b6b6b]">
        Pick a variant or keep text-only.
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {designs.map((variant) => (
          <button
            key={variant.id}
            onClick={() => onSelect(variant.id)}
            className={`rounded-2xl border-2 p-3 text-left transition-all ${selectedVariant === variant.id
              ? 'border-[#e4002b] bg-[#fff5f6]'
              : 'border-[#e4e4e4] bg-white hover:border-[#cfcfcf]'
            }`}
          >
            <div className="h-28 rounded-xl bg-[#f7f7f7] border border-[#e4e4e4] flex items-center justify-center mb-3">
              <div
                className="w-20 h-20"
                style={{ color: getContrastColor(selectedColorHex) }}
                dangerouslySetInnerHTML={{ __html: variant.svg }}
              />
            </div>
            <div className="text-sm font-semibold flex items-center justify-between">
              {variant.name}
              {selectedVariant === variant.id && (
                <span className="text-xs bg-[#e4002b] text-white px-2 py-0.5 rounded-full">Selected</span>
              )}
            </div>
            <div className="text-xs text-[#6b6b6b] mt-1 line-clamp-2">{variant.style}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
