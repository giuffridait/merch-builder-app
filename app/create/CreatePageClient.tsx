'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, Send, Sparkles, Loader2, Check } from 'lucide-react';
import { PRODUCTS, PRINT_FEE, Product } from '@/lib/catalog';
import { findIconByKeyword, ICON_LIBRARY } from '@/lib/icons';
import { generateDefaultVariants, getContrastColor, DesignVariant } from '@/lib/design';
import { addToCart, getCart } from '@/lib/cart';

import {
  Message,
  ConversationState,
  shouldGenerateDesigns,
  suggestSlogans
} from '@/lib/agent';

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cart, setCart] = useState<any[]>([]);

  const [state, setState] = useState<ConversationState>({
    stage: 'welcome',
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: "What would you like to make? A tee, hoodie, or tote?",
        timestamp: Date.now()
      }
    ]
  });

  const [designs, setDesigns] = useState<DesignVariant[] | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [textColor, setTextColor] = useState<{ name: string; hex: string } | null>(null);
  const [textColorAuto, setTextColorAuto] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [designScale, setDesignScale] = useState(1);
  const [designOffset, setDesignOffset] = useState({ x: 0, y: 0 });
  const lastGeneratedRef = useRef<string>('');
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const requestTimeoutMs = 30000;

  const COLOR_MAP: Record<string, { name: string; hex: string }> = {
    white: { name: 'White', hex: '#ffffff' },
    black: { name: 'Black', hex: '#111111' },
    navy: { name: 'Navy', hex: '#1e3a5f' },
    forest: { name: 'Forest', hex: '#2d5016' },
    burgundy: { name: 'Burgundy', hex: '#6b1f3a' },
    charcoal: { name: 'Charcoal', hex: '#4a4a4a' },
    natural: { name: 'Natural', hex: '#f5f1e8' },
    red: { name: 'Red', hex: '#e4002b' },
    pink: { name: 'Pink', hex: '#ff6fb1' },
    blue: { name: 'Blue', hex: '#2f6fed' },
    green: { name: 'Green', hex: '#2d9d78' }
  };

  const extractRequestedColor = (message: string, colors: { name: string; hex: string }[]) => {
    const text = message.toLowerCase();
    const requested = Object.keys(COLOR_MAP).find(color => text.includes(color));
    if (!requested) return null;
    const match = colors.find(c => c.name.toLowerCase() === requested);
    return { requested, match };
  };

  const extractTextColor = (message: string) => {
    const text = message.toLowerCase();
    const requested = Object.keys(COLOR_MAP).find(color => text.includes(color));
    if (!requested) return null;
    return COLOR_MAP[requested];
  };

  const getIconById = (id?: string) => {
    if (!id) return null;
    return ICON_LIBRARY.find(icon => icon.id === id) || null;
  };

  const extractRequestedSize = (message: string, sizes: string[] | null) => {
    if (!sizes || sizes.length === 0) return null;
    const text = message.toLowerCase();
    const sizeTokens = sizes.map(size => size.toLowerCase());
    const match = sizeTokens.find(size => new RegExp(`\\b${size}\\b`).test(text));
    if (!match) return null;
    const normalized = sizes.find(size => size.toLowerCase() === match) || match.toUpperCase();
    return normalized;
  };

  const extractQuantity = (message: string) => {
    const match = message.match(/(\d+)\s*(?:pcs|pieces|items|qty|quantity|shirts|hoodies|totes)?/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return Number.isNaN(value) ? null : value;
  };

  const isMaterialQuestion = (message: string) => {
    const text = message.toLowerCase();
    return text.includes('material') || text.includes('fabric');
  };

  useEffect(() => {
    setCart(getCart());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => {
    if (state.product) {
      // Sync selected color if current one is invalid or not set
      const currentIsValid = selectedColor && state.product.colors.some(c => c.hex === selectedColor.hex);
      if (!currentIsValid) {
        setSelectedColor(state.product.colors[0]);
      }

      // Sync selected size if current one is invalid or not set
      const currentSizeIsValid = selectedSize && state.product.sizes?.includes(selectedSize);
      if (!currentSizeIsValid) {
        setSelectedSize(state.product.sizes ? (state.product.sizes[2] || state.product.sizes[0]) : null);
      }
    }
  }, [state.product]);

  useEffect(() => {
    if (state.productColor && state.product) {
      const match = state.product.colors.find(
        c => c.name.toLowerCase() === state.productColor?.toLowerCase()
      );
      if (match) setSelectedColor(match);
    }
  }, [state.productColor, state.product]);

  useEffect(() => {
    if (state.size && state.product?.sizes?.includes(state.size)) {
      setSelectedSize(state.size);
    }
  }, [state.size, state.product]);

  useEffect(() => {
    if (state.textColor) {
      const colorKey = state.textColor.toLowerCase();
      const match = COLOR_MAP[colorKey];
      if (match) {
        setTextColor(match);
        setTextColorAuto(false);
      }
    }
  }, [state.textColor]);

  useEffect(() => {
    if (!selectedColor) return;
    if (!textColor || textColorAuto) {
      const auto = getContrastColor(selectedColor.hex);
      setTextColor(auto === '#1a1a1a'
        ? { name: 'Black', hex: '#1a1a1a' }
        : { name: 'White', hex: '#ffffff' });
      setTextColorAuto(true);
    }
  }, [selectedColor]);

  useEffect(() => {
    console.log('[DEBUG] Design generation useEffect', {
      hasText: !!state.text,
      hasProduct: !!state.product,
      text: state.text,
      icon: state.icon,
      productName: state.product?.name
    });
    if ((!state.text && !state.icon) || !state.product) return;
    const text = state.text || '';
    const key = `${text}|${state.icon || 'default'}|${state.vibe || ''}|${state.occasion || ''}`;
    if (lastGeneratedRef.current === key) {
      console.log('[DEBUG] Skipping design generation - already generated for this key:', key);
      return;
    }

    console.log('[DEBUG] Generating designs in useEffect');
    const icon = getIconById(state.icon) || ICON_LIBRARY.find(i => i.id === 'star') || ICON_LIBRARY[0];
    const generated = generateDefaultVariants(text, icon);
    setDesigns(generated.variants);
    if (!selectedVariant || !generated.variants.find(v => v.id === selectedVariant)) {
      setSelectedVariant(generated.recommended);
    }
    lastGeneratedRef.current = key;
  }, [state.text, state.icon, state.vibe, state.occasion, state.product, selectedVariant]);

  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId) return;
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    setState(prev => ({
      ...prev,
      product,
      stage: prev.stage === 'welcome' ? 'intent' : prev.stage
    }));
  }, [searchParams]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const id = Date.now().toString();
    const message: Message = {
      id,
      role,
      content,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
    return id;
  };

  const updateMessageContent = (id: string, append: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === id ? { ...m, content: m.content + append } : m
      )
    }));
  };

  const setMessageContent = (id: string, content: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === id ? { ...m, content } : m
      )
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);
    setIsTyping(true);
    setFallbackNotice(false);

    // Initial check for buy intent - can be handled locally for speed
    const isAddToCartIntent = /add to cart|checkout|ready to buy|buy now/i.test(userMessage);
    if (isAddToCartIntent && state.product && (state.text || state.icon) && selectedColor) {
      handleAddToCart();
      setIsTyping(false);
      return;
    }

    const applyUpdates = async (updates: any, assistantMessage?: string, shouldAddMessage = true) => {
      if (!updates.textColor) {
        const lower = userMessage.toLowerCase();
        if (lower.includes('text') || lower.includes('icon') || lower.includes('logo')) {
          const requested = extractTextColor(userMessage);
          if (requested) {
            updates.textColor = requested.name.toLowerCase();
          }
        }
      }

      if (updates.action === 'remove_icon') {
        updates.icon = 'none';
      }

      if (updates.productId && !updates.product) {
        const newProduct = PRODUCTS.find(p => p.id === updates.productId);
        if (newProduct) updates.product = newProduct;
      }

      let updatedState = { ...state, ...updates };
      setState(prev => {
        updatedState = { ...prev, ...updates };
        return updatedState;
      });

      if (shouldAddMessage && assistantMessage) {
        const trimmed = assistantMessage.trim();
        const generic = /^design\b/i.test(trimmed) || trimmed.length < 8;
        const followUp = updatedState.product
          ? `Want to tweak the color, text, or add an icon?`
          : `What would you like to make next?`;
        const finalMessage = generic ? `${followUp}` : assistantMessage;
        addMessage('assistant', finalMessage);
      }

      if (updates.action === 'add_to_cart') {
        handleAddToCart();
        setIsTyping(false);
        return;
      }

      if (updates.productColor && updatedState.product) {
        const match = updatedState.product.colors.find(
          (c: { name: string; hex: string }) => c.name.toLowerCase() === updates.productColor.toLowerCase()
        );
        if (match) setSelectedColor(match);
      }
      if (updates.textColor) {
        const map = COLOR_MAP[updates.textColor.toLowerCase()];
        if (map) {
          setTextColor(map);
          setTextColorAuto(false);
        }
      }
      if (updates.size && updatedState.product?.sizes?.includes(updates.size)) {
        setSelectedSize(updates.size);
      }
      if (updates.quantity) {
        setQuantity(updates.quantity);
      }

      if (shouldGenerateDesigns(updatedState)) {
        addMessage('assistant', 'Perfect! Let me generate 3 design variants for you... ✨');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setState(prev => ({ ...prev, stage: 'preview' }));
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const history = state.messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, state, messages: history, stream: true }),
        signal: controller.signal
      });

      if (!res.ok) throw new Error('Failed to connect to assistant');

      const isStream = res.headers.get('content-type')?.includes('text/event-stream');
      if (!isStream || !res.body) {
        const data = await res.json();
        setFallbackNotice(!!data.fallbackUsed);
        await applyUpdates(data.updates || {}, data.assistantMessage || "I've updated the design for you.");
        setIsTyping(false);
        return;
      }

      const assistantId = addMessage('assistant', '');
      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let buffer = '';
      let updates: any = {};
      let assistantText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let event = 'message';
          let data = '';
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.replace('event:', '').trim();
            if (line.startsWith('data:')) data += line.replace('data:', '').trim();
          }

          if (event === 'updates') {
            try {
              updates = JSON.parse(data);
            } catch {
              updates = {};
            }
          } else if (event === 'delta') {
            let text = data;
            try {
              const delta = JSON.parse(data);
              text = typeof delta === 'string' ? delta : '';
            } catch {
              text = data;
            }
            assistantText += text;
            updateMessageContent(assistantId, text);
          } else if (event === 'done') {
            const payload = JSON.parse(data);
            setFallbackNotice(!!payload.fallbackUsed);
            await applyUpdates(updates || {}, assistantText, false);
            const trimmed = assistantText.trim();
            const generic = /^design\b/i.test(trimmed) || trimmed.length < 8;
            if (generic) {
              const followUp = state.product
                ? `Want to tweak the color, text, or add an icon?`
                : `What would you like to make next?`;
              setMessageContent(assistantId, followUp);
            }
          }
        }
      }

      setIsTyping(false);
    } catch (err) {
      console.error('LLM Error:', err);
      addMessage('assistant', "I'm having a bit of trouble connecting right now. Please try again!");
      setIsTyping(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };


  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const buildTextOnlySVG = (text: string) => `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="210" font-family="'Helvetica Neue', sans-serif" font-size="56" font-weight="700" text-anchor="middle" fill="currentColor" letter-spacing="1">
        ${text.toUpperCase()}
      </text>
    </svg>
  `;

  const allDesigns = designs || null;

  const handleAddToCart = () => {
    if (!state.product) return;
    if (!selectedColor || !state.text) {
      addMessage('assistant', 'Add a short text and choose a product color to add this to cart.');
      return;
    }

    const fallbackVariantId = designs?.[0]?.id || 'text-only';
    const activeVariantId = selectedVariant || fallbackVariantId;

    const variant = (designs || []).find(v => v.id === activeVariantId);
    const designSvg = variant?.svg || buildTextOnlySVG(state.text);

    const itemPrice = state.product.basePrice + PRINT_FEE;

    const newCart = addToCart({
      productId: state.product.id,
      productName: state.product.name,
      color: selectedColor,
      textColor: textColor || undefined,
      size: selectedSize,
      quantity,
      variant: activeVariantId,
      designSVG: designSvg,
      text: state.text!,
      icon: state.icon || 'none',
      price: itemPrice,
      total: itemPrice * quantity,
      currency: 'EUR',
      deliveryEstimateDays: 7
    });

    setCart(newCart);
    addMessage('assistant', `Awesome! Added to cart. Want to create another design or check out?`);
  };

  const suggestedActions = () => {
    switch (state.stage) {
      case 'welcome':
      case 'product':
        return ['Tee for a gift', 'Hoodie for my team', 'Tote bag for myself'];
      case 'intent':
        return ['Birthday gift, bold', 'Team shirt, minimal', 'Personal, retro style'];
      case 'text':
        const slogans = suggestSlogans(state.occasion, state.vibe);
        return slogans.slice(0, 4).map(s => `"${s}"`);
      case 'icon':
        return ['coffee cup', 'lightning bolt', 'mountain', 'heart'];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#111111] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#e4e4e4]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-lg" />
            <span className="text-xl font-bold tracking-tight">MerchForge</span>
          </button>

          <button
            onClick={() => router.push('/cart')}
            className="relative px-4 py-2 rounded-full bg-[#f7f7f7] hover:bg-[#efefef] transition-all flex items-center gap-2 border border-[#e4e4e4]"
          >
            <ShoppingCart size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#e4002b] rounded-full text-xs flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
            <span className="hidden sm:inline">Cart</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-10 pb-40">
        <div className="grid lg:grid-cols-[360px_1fr] gap-10 h-full">
          {/* Left: Chat */}
          <div className="flex flex-col">
            <div className="bg-white border border-[#e4e4e4] rounded-2xl p-5 shadow-sm">
              {/* Messages */}
              <div className="space-y-3 max-h-[36vh] overflow-y-auto pr-1">
                {state.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === 'user'
                        ? 'bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] text-white'
                        : 'bg-[#f7f7f7] border border-[#e4e4e4]'
                        }`}
                    >
                      <p className="leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[#f7f7f7] border border-[#e4e4e4] rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-[#e4002b]" />
                        <span className="text-sm text-[#6b6b6b]">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {fallbackNotice && (
                <div className="mt-3 text-xs text-[#e4002b]">
                  Using fallback mode (AI unavailable). Responses may be less flexible.
                </div>
              )}

              {/* Quick Actions */}
              {suggestedActions().length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-[#6b6b6b] mb-2">Quick suggestions:</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedActions().map((action) => (
                      <button
                        key={action}
                        onClick={() => handleQuickAction(action)}
                        className="px-2.5 py-1 text-xs bg-[#f7f7f7] hover:bg-[#efefef] border border-[#e4e4e4] rounded-full transition-all"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="mt-4 flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-white border border-[#e4e4e4] rounded-2xl focus:outline-none focus:border-[#e4002b] transition-all text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="px-6 py-3 bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] rounded-2xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex flex-col">
            <div className="bg-white rounded-2xl p-8 border border-[#e4e4e4] mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#6b6b6b]">LIVE PREVIEW</h3>
                {state.product && (
                  <div className="text-xs text-[#6b6b6b]">
                    {state.product.name} • €{(state.product.basePrice + PRINT_FEE).toFixed(2)}
                  </div>
                )}
              </div>

              {state.product ? (
                <div className="relative aspect-[4/5] bg-white rounded-2xl overflow-hidden border border-[#e4e4e4]">
                  <div className="absolute inset-0 bg-white" />
                  <img
                    src={
                      state.product.imageUrlByColor?.[selectedColor?.name?.toLowerCase() || ''] ||
                      state.product.imageUrl
                    }
                    alt={state.product.name}
                    className="absolute inset-0 w-full h-full object-contain p-12 bg-white"
                  />

                  {/* Design overlay */}
                  {designs && selectedVariant && (
                    <div
                      className="absolute"
                      style={{
                        left: `${state.product.printArea.x}%`,
                        top: `${state.product.printArea.y}%`,
                        width: `${state.product.printArea.w}%`,
                        height: `${state.product.printArea.h}%`,
                        color: textColor?.hex || getContrastColor(selectedColor?.hex || '#ffffff'),
                        transform: `translate(${designOffset.x}px, ${designOffset.y}px) scale(${designScale})`,
                        transformOrigin: 'center'
                      }}
                      dangerouslySetInnerHTML={{
                        __html: (allDesigns?.find(v => v.id === selectedVariant)?.svg) || ''
                      }}
                    />
                  )}
                  {!designs && state.text && (
                    <div
                      className="absolute flex items-center justify-center text-center px-4"
                      style={{
                        left: `${state.product.printArea.x}%`,
                        top: `${state.product.printArea.y}%`,
                        width: `${state.product.printArea.w}%`,
                        height: `${state.product.printArea.h}%`,
                        color: textColor?.hex || getContrastColor(selectedColor?.hex || '#ffffff'),
                        fontWeight: 700,
                        fontSize: '1.4rem',
                        transform: `translate(${designOffset.x}px, ${designOffset.y}px) scale(${designScale})`,
                        transformOrigin: 'center',
                        textTransform: 'uppercase'
                      }}
                    >
                      {state.text}
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

              {state.product && (
                <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#6b6b6b]">
                  <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                    Product: <span className="text-[#111111] font-medium">{state.product.name}</span>
                  </span>
                  <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                    Color: <span className="text-[#111111] font-medium">{selectedColor?.name || 'Choose'}</span>
                  </span>
                  {state.product.sizes && (
                    <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                      Size: <span className="text-[#111111] font-medium">{selectedSize || 'Choose'}</span>
                    </span>
                  )}
                  {!state.product.sizes && (
                    <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                      Size: <span className="text-[#111111] font-medium">One size</span>
                    </span>
                  )}
                  <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                    Text: <span className="text-[#111111] font-medium">{state.text ? `"${state.text}"` : 'Add text'}</span>
                  </span>
                  <span className="px-3 py-1.5 rounded-full border border-[#e4e4e4] bg-white">
                    Text color: <span className="text-[#111111] font-medium">{textColor?.name || 'Auto'}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Design Variants */}
            {(state.text || state.icon) && state.product && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-medium text-[#6b6b6b]">DESIGN VARIANTS</h3>
                <div className="text-xs text-[#6b6b6b]">
                  {designs
                    ? 'Pick a variant or skip to keep text‑only.'
                    : 'Add an icon to generate design variants, or continue with text‑only.'}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(allDesigns || []).map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all ${selectedVariant === variant.id
                        ? 'border-[#e4002b] bg-[#fff5f6]'
                        : 'border-[#e4e4e4] bg-white hover:border-[#cfcfcf]'
                        }`}
                    >
                      <div className="h-28 rounded-xl bg-[#f7f7f7] border border-[#e4e4e4] flex items-center justify-center mb-3">
                        <div
                          className="w-20 h-20"
                          style={{ color: getContrastColor(selectedColor?.hex || '#ffffff') }}
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

                {/* Product Options */}
                <div className="space-y-4 pt-4 border-t border-[#e4e4e4]">
                  <div className="text-xs text-[#6b6b6b]">
                    Flow: Configuration → Print validation → Concrete configuration
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Color</label>
                    <div className="flex gap-2">
                      {state.product?.colors.map(color => (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(color)}
                          className={`w-12 h-12 rounded-full border-2 transition-all ${selectedColor?.name === color.name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'
                            }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Text color</label>
                    <div className="flex gap-2 flex-wrap">
                      {['Black', 'White', 'Red', 'Pink', 'Navy', 'Burgundy', 'Forest'].map((name) => {
                        const swatch = COLOR_MAP[name.toLowerCase()];
                        return (
                          <button
                            key={name}
                            onClick={() => {
                              setTextColor(swatch);
                              setTextColorAuto(false);
                            }}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${textColor?.name === name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'
                              }`}
                            style={{ backgroundColor: swatch.hex }}
                            title={name}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Icon (optional)</label>
                    <div className="grid grid-cols-6 gap-2">
                      {ICON_LIBRARY.slice(0, 12).map((icon) => (
                        <button
                          key={icon.id}
                          onClick={() => setState(prev => ({ ...prev, icon: icon.id }))}
                          className={`h-10 w-10 rounded-xl border transition-all flex items-center justify-center ${state.icon === icon.id ? 'border-[#e4002b] bg-[#fff5f6]' : 'border-[#e4e4e4] bg-white hover:border-[#cfcfcf]'
                            }`}
                          title={icon.id}
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#111111]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={icon.path} />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-[#6b6b6b] mt-2">
                      Pick an icon to generate variants, or keep text‑only.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Design scale</label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.0"
                        step="0.05"
                        value={designScale}
                        onChange={(e) => setDesignScale(parseFloat(e.target.value))}
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
                            onChange={(e) => setDesignOffset(prev => ({ ...prev, x: parseInt(e.target.value, 10) }))}
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
                            onChange={(e) => setDesignOffset(prev => ({ ...prev, y: parseInt(e.target.value, 10) }))}
                            className="w-full accent-[#e4002b]"
                          />
                          <div className="text-xs text-[#6b6b6b] mt-1">Y {designOffset.y}px</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDesignOffset({ x: 0, y: 0 })}
                        className="mt-2 text-xs text-[#6b6b6b] hover:text-[#111111] transition-colors"
                      >
                        Reset position
                      </button>
                    </div>
                  </div>

                  {state.product?.sizes && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Size</label>
                      <div className="flex gap-2">
                        {state.product.sizes.map(size => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
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

                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-24 px-4 py-2 bg-white border border-[#e4e4e4] rounded-lg focus:outline-none focus:border-[#e4002b]"
                    />
                  </div>

                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedColor || (!state.text && !state.icon)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={20} />
                    Add to Cart • €{((state.product!.basePrice + PRINT_FEE) * quantity).toFixed(2)}
                  </button>
                  {(!selectedColor || (!state.text && !state.icon)) && (
                    <div className="text-xs text-[#6b6b6b]">
                      Add text or an icon and choose a product color to enable add to cart.
                    </div>
                  )}
                  <div className="text-xs text-[#6b6b6b]">
                    Cart-ready item includes preview, final price, and estimated delivery.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}
