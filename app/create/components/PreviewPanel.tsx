'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Product, PRINT_FEE } from '@/lib/catalog';
import { getContrastColor, DesignVariant } from '@/lib/design';

interface PreviewPanelProps {
  product?: Product;
  selectedColor: { name: string; hex: string } | null;
  textColor: { name: string; hex: string } | null;
  allDesigns: DesignVariant[] | null;
  selectedVariant: string | null;
  designScale: number;
  designOffset: { x: number; y: number };
  text?: string;
  selectedSize: string | null;
}

export default function PreviewPanel({
  product,
  selectedColor,
  textColor,
  allDesigns,
  selectedVariant,
  designScale,
  designOffset,
  text,
  selectedSize
}: PreviewPanelProps) {
  const designColor = textColor?.hex || getContrastColor(selectedColor?.hex || '#ffffff');

  return (
    <div className="bg-white rounded-2xl p-8 border border-[#e4e4e4] mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#6b6b6b]">LIVE PREVIEW</h3>
        {product && (
          <div className="text-xs text-[#6b6b6b]">
            {product.name} &bull; &euro;{(product.basePrice + PRINT_FEE).toFixed(2)}
          </div>
        )}
      </div>

      {product ? (
        <div className="relative aspect-[4/5] bg-white rounded-2xl overflow-hidden border border-[#e4e4e4]">
          <div className="absolute inset-0 bg-white" />
          <img
            src={
              product.imageUrlByColor?.[selectedColor?.name?.toLowerCase() || ''] ||
              product.imageUrl
            }
            alt={product.name}
            className="absolute inset-0 w-full h-full object-contain p-12 bg-white"
          />

          {/* Design overlay */}
          {allDesigns && selectedVariant && (
            <div
              className="absolute"
              style={{
                left: `${product.printArea.x}%`,
                top: `${product.printArea.y}%`,
                width: `${product.printArea.w}%`,
                height: `${product.printArea.h}%`,
                color: designColor,
                transform: `translate(${designOffset.x}px, ${designOffset.y}px) scale(${designScale})`,
                transformOrigin: 'center'
              }}
              dangerouslySetInnerHTML={{
                __html: allDesigns.find(v => v.id === selectedVariant)?.svg || ''
              }}
            />
          )}
          {!allDesigns && text && (
            <div
              className="absolute flex items-center justify-center text-center px-4"
              style={{
                left: `${product.printArea.x}%`,
                top: `${product.printArea.y}%`,
                width: `${product.printArea.w}%`,
                height: `${product.printArea.h}%`,
                color: designColor,
                fontWeight: 700,
                fontSize: '1.4rem',
                transform: `translate(${designOffset.x}px, ${designOffset.y}px) scale(${designScale})`,
                transformOrigin: 'center',
                textTransform: 'uppercase'
              }}
            >
              {text}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-[#f7f7f7] rounded-xl flex items-center justify-center text-[#6b6b6b] border border-[#e4e4e4]">
          <div className="text-center">
            <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
            <p>Preview will appear here</p>
          </div>
        </div>
      )}

      {product && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#6b6b6b]">
          <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
            Product: <span className="text-[#111111] font-medium">{product.name}</span>
          </span>
          <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
            Color: <span className="text-[#111111] font-medium">{selectedColor?.name || 'Choose'}</span>
          </span>
          {product.sizes ? (
            <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
              Size: <span className="text-[#111111] font-medium">{selectedSize || 'Choose'}</span>
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
              Size: <span className="text-[#111111] font-medium">One size</span>
            </span>
          )}
          <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
            Text: <span className="text-[#111111] font-medium">{text ? `"${text}"` : 'Add text'}</span>
          </span>
          <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
            Text color: <span className="text-[#111111] font-medium">{textColor?.name || 'Auto'}</span>
          </span>
        </div>
      )}
    </div>
  );
}
