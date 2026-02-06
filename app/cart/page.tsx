'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, X, Plus, Minus } from 'lucide-react';
import { getCart, removeFromCart as removeItem, updateQuantity as updateQty, clearCart as clearAll, CartItem } from '@/lib/cart';
import { getContrastColor } from '@/lib/design';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(getCart());
  }, []);

  const handleRemove = (id: number) => {
    const newCart = removeItem(id);
    setCart(newCart);
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    if (quantity < 1) return;
    const newCart = updateQty(id, quantity);
    setCart(newCart);
  };

  const handleClear = () => {
    if (confirm('Clear all items from cart?')) {
      clearAll();
      setCart([]);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#111111]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#e4e4e4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/create')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-lg" />
            <span className="text-xl font-bold tracking-tight">MerchForge</span>
          </button>
          
          <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
            <ShoppingCart size={16} />
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Cart</h1>
          <p className="text-[#6b6b6b]">Review your custom designs</p>
        </div>

        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#e4e4e4] shadow-sm">
            <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">Your cart is empty</h3>
            <p className="text-[#6b6b6b] mb-6">Start creating your custom merch!</p>
            <button
              onClick={() => router.push('/create')}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all"
            >
              Start Creating
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart Items */}
            {cart.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-6 border border-[#e4e4e4] animate-fadeIn shadow-sm"
              >
                <div className="flex gap-6">
                  {/* Preview */}
                  <div className="w-32 h-32 bg-[#f7f7f7] rounded-xl relative flex-shrink-0 border border-[#e4e4e4]">
                    <div
                      className="absolute inset-0 flex items-center justify-center text-5xl opacity-20"
                      style={{ color: item.color.hex }}
                    >
                      {item.productName.includes('Tee') && '👕'}
                      {item.productName.includes('Hoodie') && '🧥'}
                      {item.productName.includes('Tote') && '👜'}
                      {item.productName.includes('Mug') && '☕'}
                    </div>
                    <div
                      className="absolute"
                      style={{
                        left: '20%',
                        top: '25%',
                        width: '60%',
                        height: '50%',
                        color: getContrastColor(item.color.hex)
                      }}
                      dangerouslySetInnerHTML={{ __html: item.designSVG }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{item.productName}</h3>
                        <div className="text-sm text-[#6b6b6b] space-y-1 mt-1">
                          <div>Variant {item.variant} • {item.color.name}</div>
                          {item.size && <div>Size: {item.size}</div>}
                          <div className="italic">"{item.text}"</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-2 hover:bg-[#f7f7f7] rounded-lg transition-all"
                        title="Remove item"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-[#f7f7f7] hover:bg-[#efefef] flex items-center justify-center transition-all border border-[#e4e4e4]"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-[#f7f7f7] hover:bg-[#efefef] flex items-center justify-center transition-all border border-[#e4e4e4]"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <div className="text-xs text-[#6b6b6b]">€{item.price.toFixed(2)} each</div>
                        <div className="text-xl font-bold">€{item.total.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="bg-white rounded-2xl p-6 border-2 border-[#e4002b] shadow-sm">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm text-[#6b6b6b]">
                  <span>Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                  <span>€{cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="border-t border-[#e4e4e4] pt-4 flex justify-between items-center">
                  <span className="text-xl font-bold">Total</span>
                  <span className="text-3xl font-bold">€{cartTotal.toFixed(2)}</span>
                </div>

                <button className="w-full py-4 rounded-full bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-bold text-lg">
                  Proceed to Checkout
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push('/create')}
                    className="flex-1 py-3 rounded-full bg-[#f7f7f7] hover:bg-[#efefef] transition-all text-sm border border-[#e4e4e4]"
                  >
                    Continue Shopping
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-6 py-3 rounded-full bg-[#f7f7f7] hover:bg-[#efefef] transition-all text-sm border border-[#e4e4e4]"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
