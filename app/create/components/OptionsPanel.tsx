'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Product, PRINT_FEE } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { TEXT_COLOR_OPTIONS } from '@/lib/customization-constraints';

interface OptionsPanelProps {
  product: Product;
  selectedColor: { name: string; hex: string } | null;
  onColorSelect: (color: { name: string; hex: string }) => void;
  textColor: { name: string; hex: string } | null;
  onTextColorSelect: (color: { name: string; hex: string }) => void;
  icon?: string;
  onIconSelect: (iconId: string) => void;
  designScale: number;
  onScaleChange: (scale: number) => void;
  designOffset: { x: number; y: number };
  onOffsetChange: (offset: { x: number; y: number }) => void;
  selectedSize: string | null;
  onSizeSelect: (size: string) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  isCartReady: boolean;
  onAddToCart: () => void;
  hasDesign: boolean;
}

const TEXT_COLOR_SWATCHES = ['Black', 'White', 'Red', 'Pink', 'Navy', 'Burgundy', 'Forest'];

export default function OptionsPanel({
  product,
  selectedColor,
  onColorSelect,
  textColor,
  onTextColorSelect,
  icon,
  onIconSelect,
  designScale,
  onScaleChange,
  designOffset,
  onOffsetChange,
  selectedSize,
  onSizeSelect,
  quantity,
  onQuantityChange,
  isCartReady,
  onAddToCart,
  hasDesign
}: OptionsPanelProps) {
  const totalPrice = (product.basePrice + PRINT_FEE) * quantity;

  return (
    <div className="space-y-4 pt-4 border-t border-[#e4e4e4]">
      {/* Product Color */}
      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="flex gap-2">
          {product.colors.map(color => (
            <button
              key={color.name}
              onClick={() => onColorSelect(color)}
              className={`w-12 h-12 rounded-full border-2 transition-all ${selectedColor?.name === color.name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'}`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="block text-sm font-medium mb-2">Text color</label>
        <div className="flex gap-2 flex-wrap">
          {TEXT_COLOR_SWATCHES.map((name) => {
            const swatch = TEXT_COLOR_OPTIONS[name.toLowerCase()];
            return (
              <button
                key={name}
                onClick={() => onTextColorSelect(swatch)}
                className={`w-10 h-10 rounded-full border-2 transition-all ${textColor?.name === name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'}`}
                style={{ backgroundColor: swatch.hex }}
                title={name}
              />
            );
          })}
        </div>
      </div>

      {/* Icon Picker */}
      <div>
        <label className="block text-sm font-medium mb-2">Icon (optional)</label>
        <div className="grid grid-cols-6 gap-2">
          {ICON_LIBRARY.slice(0, 12).map((ic) => (
            <button
              key={ic.id}
              onClick={() => onIconSelect(ic.id)}
              className={`h-10 w-10 rounded-xl border transition-all flex items-center justify-center ${icon === ic.id ? 'border-[#e4002b] bg-[#fff5f6]' : 'border-[#e4e4e4] bg-white hover:border-[#cfcfcf]'}`}
              title={ic.id}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#111111]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ic.path} />
              </svg>
            </button>
          ))}
        </div>
        <div className="text-xs text-[#6b6b6b] mt-2">
          Pick an icon to generate variants, or keep text-only.
        </div>
      </div>

      {/* Scale & Position */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Design scale</label>
          <input
            type="range"
            min="0.6"
            max="1.0"
            step="0.05"
            value={designScale}
            onChange={(e) => onScaleChange(parseFloat(e.target.value))}
            className="w-full accent-[#e4002b]"
          />
          <div className="text-xs text-[#6b6b6b] mt-1">{(designScale * 100).toFixed(0)}%</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={designOffset.x}
                onChange={(e) => onOffsetChange({ ...designOffset, x: parseInt(e.target.value, 10) })}
                className="w-full accent-[#e4002b]"
              />
              <div className="text-xs text-[#6b6b6b] mt-1">X {designOffset.x}px</div>
            </div>
            <div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={designOffset.y}
                onChange={(e) => onOffsetChange({ ...designOffset, y: parseInt(e.target.value, 10) })}
                className="w-full accent-[#e4002b]"
              />
              <div className="text-xs text-[#6b6b6b] mt-1">Y {designOffset.y}px</div>
            </div>
          </div>
          <button
            onClick={() => onOffsetChange({ x: 0, y: 0 })}
            className="mt-2 text-xs text-[#6b6b6b] hover:text-[#111111] transition-colors"
          >
            Reset position
          </button>
        </div>
      </div>

      {/* Size */}
      {product.sizes && (
        <div>
          <label className="block text-sm font-medium mb-2">Size</label>
          <div className="flex gap-2">
            {product.sizes.map(size => (
              <button
                key={size}
                onClick={() => onSizeSelect(size)}
                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${selectedSize === size
                  ? 'bg-[#f7f7f7] border-[#e4002b]'
                  : 'bg-white border-transparent hover:border-[#e4e4e4]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium mb-2">Quantity</label>
        <input
          type="number"
          min="1"
          max="99"
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
          className="w-24 px-4 py-2 bg-white border border-[#e4e4e4] rounded-lg focus:outline-none focus:border-[#e4002b]"
        />
      </div>

      {/* Add to Cart */}
      <button
        onClick={onAddToCart}
        disabled={!isCartReady}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShoppingCart size={20} />
        Add to Cart &bull; &euro;{totalPrice.toFixed(2)}
      </button>
      {!isCartReady && (
        <div className="text-xs text-[#6b6b6b]">
          {!hasDesign ? 'Add text or an icon' : 'Choose a product color'} to enable add to cart.
        </div>
      )}
    </div>
  );
}
