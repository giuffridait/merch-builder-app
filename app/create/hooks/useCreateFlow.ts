'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRODUCTS, PRINT_FEE, Product } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { getContrastColor, DesignVariant } from '@/lib/design';
import { addToCart, getCart } from '@/lib/cart';
import { TEXT_COLOR_OPTIONS } from '@/lib/customization-constraints';
import {
  Message,
  ConversationState,
  canPreview,
  canAddToCart,
  getMissingFields,
  suggestSlogans
} from '@/lib/agent';

export function useCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cart, setCart] = useState<any[]>([]);

  const [state, setState] = useState<ConversationState>({
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: "What would you like to make? A tee, hoodie, or tote? You can tell me everything at once — like 'navy tee with Dream Big and a star'.",
        timestamp: Date.now()
      }
    ]
  });

  const [designs, setDesigns] = useState<DesignVariant[] | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [textColor, setTextColor] = useState<{ name: string; hex: string } | null>(null);
  const [textColorAuto, setTextColorAuto] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [designScale, setDesignScale] = useState(1);
  const [designOffset, setDesignOffset] = useState({ x: 0, y: 0 });
  const lastGeneratedRef = useRef<string>('');
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => { setCart(getCart()); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // ── Product from URL param ──────────────────────────────────────────────────

  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId) return;
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    setState(prev => ({ ...prev, product }));
  }, [searchParams]);

  // ── Sync selected color/size when product changes ───────────────────────────

  useEffect(() => {
    if (state.product) {
      const currentIsValid = selectedColor && state.product.colors.some(c => c.hex === selectedColor.hex);
      if (!currentIsValid) setSelectedColor(state.product.colors[0]);

      const currentSizeIsValid = selectedSize && state.product.sizes?.includes(selectedSize);
      if (!currentSizeIsValid) {
        setSelectedSize(state.product.sizes ? (state.product.sizes[2] || state.product.sizes[0]) : null);
      }
    }
  }, [state.product]);

  useEffect(() => {
    if (state.productColor && state.product) {
      const match = state.product.colors.find(c => c.name.toLowerCase() === state.productColor?.toLowerCase());
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
      const match = TEXT_COLOR_OPTIONS[state.textColor.toLowerCase()];
      if (match) {
        setTextColor(match);
        setTextColorAuto(false);
      }
    }
  }, [state.textColor]);

  // ── Auto text color contrast ────────────────────────────────────────────────

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

  // ── Design generation on state change (LLM-powered) ─────────────────────────

  const [designsLoading, setDesignsLoading] = useState(false);

  useEffect(() => {
    if ((!state.text && !state.icon) || !state.product) return;
    const text = state.text || '';
    const key = `${text}|${state.icon || 'default'}|${state.vibe || ''}|${state.occasion || ''}`;
    if (lastGeneratedRef.current === key) return;
    lastGeneratedRef.current = key;

    let cancelled = false;
    setDesignsLoading(true);

    fetch('/api/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        iconId: state.icon,
        vibe: state.vibe,
        occasion: state.occasion
      })
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.variants && data.variants.length > 0) {
          setDesigns(data.variants);
          if (!selectedVariant || !data.variants.find((v: DesignVariant) => v.id === selectedVariant)) {
            setSelectedVariant(data.recommended || data.variants[0].id);
          }
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Design generation failed:', err);
      })
      .finally(() => {
        if (!cancelled) setDesignsLoading(false);
      });

    return () => { cancelled = true; };
  }, [state.text, state.icon, state.vibe, state.occasion, state.product]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const id = Date.now().toString();
    const message: Message = { id, role, content, timestamp: Date.now() };
    setState(prev => ({ ...prev, messages: [...prev.messages, message] }));
    return id;
  }, []);

  const buildTextOnlySVG = (text: string) => `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="210" font-family="'Helvetica Neue', sans-serif" font-size="56" font-weight="700" text-anchor="middle" fill="currentColor" letter-spacing="1">
        ${text.toUpperCase()}
      </text>
    </svg>
  `;

  const textOnlyVariant: DesignVariant = {
    id: 'text-only',
    name: 'Text Only',
    layout: 'text_only',
    style: 'Modern & Clean',
    svg: state.text ? buildTextOnlySVG(state.text) : '',
    score: 80,
    reasoning: 'Simple and effective.'
  };

  const allDesigns = designs ? [textOnlyVariant, ...designs] : null;

  // ── Send Message (streaming) ────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);
    setIsTyping(true);
    setFallbackNotice(false);
    setStreamingText('');

    // Local cart intent shortcut
    const isAddToCartIntent = /add to cart|checkout|ready to buy|buy now/i.test(userMessage);
    if (isAddToCartIntent && state.product && (state.text || state.icon) && selectedColor) {
      handleAddToCart();
      setIsTyping(false);
      return;
    }

    try {
      const history = state.messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, state, stream: true })
      });

      if (!res.ok) throw new Error('Failed to connect to assistant');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (currentEvent === 'delta') {
                accumulatedText += parsed;
                setStreamingText(accumulatedText);
              } else if (currentEvent === 'updates') {
                const updates = parsed || {};

                if (updates.action === 'remove_icon') {
                  updates.icon = 'none';
                }

                if (updates.productId && !updates.product) {
                  const newProduct = PRODUCTS.find(p => p.id === updates.productId);
                  if (newProduct) updates.product = newProduct;
                }

                setState(prev => ({ ...prev, ...updates }));

                if (updates.productColor) {
                  const match = state.product?.colors.find(
                    (c: { name: string; hex: string }) => c.name.toLowerCase() === updates.productColor.toLowerCase()
                  );
                  if (match) setSelectedColor(match);
                }
                if (updates.textColor) {
                  const map = TEXT_COLOR_OPTIONS[updates.textColor.toLowerCase()];
                  if (map) { setTextColor(map); setTextColorAuto(false); }
                }
                if (updates.size && state.product?.sizes?.includes(updates.size)) {
                  setSelectedSize(updates.size);
                }
                if (updates.quantity) setQuantity(updates.quantity);

                if (updates.action === 'add_to_cart') {
                  handleAddToCart();
                  setIsTyping(false);
                  setStreamingText('');
                  return;
                }
              } else if (currentEvent === 'done') {
                setFallbackNotice(!!parsed.fallbackUsed);
              }
            } catch { /* skip malformed SSE data */ }
          }
        }
      }

      if (accumulatedText) {
        addMessage('assistant', accumulatedText);
      }
      setStreamingText('');
      setIsTyping(false);
    } catch (err) {
      console.error('LLM Error:', err);
      addMessage('assistant', "I'm having a bit of trouble connecting right now. Please try again!");
      setStreamingText('');
      setIsTyping(false);
    }
  }, [input, isTyping, state, selectedColor, addMessage]);

  // ── Add to Cart ─────────────────────────────────────────────────────────────

  const handleAddToCart = useCallback(() => {
    if (!state.product) return;
    if (!selectedColor || !state.text) {
      addMessage('assistant', 'Add a short text and choose a product color to add this to cart.');
      return;
    }

    const fallbackVariantId = designs?.[0]?.id || 'text-only';
    const activeVariantId = selectedVariant || fallbackVariantId;
    const variant = (designs || []).find(v => v.id === activeVariantId) || (activeVariantId === 'text-only' ? textOnlyVariant : undefined);
    const designSvg = variant?.svg || buildTextOnlySVG(state.text);
    const itemPrice = state.product.basePrice + PRINT_FEE;
    const isTextOnly = activeVariantId === 'text-only';

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
      icon: isTextOnly ? 'none' : (state.icon || 'none'),
      price: itemPrice,
      total: itemPrice * quantity,
      currency: 'EUR',
      deliveryEstimateDays: 7
    });

    setCart(newCart);
    addMessage('assistant', 'Awesome! Added to cart. Want to create another design or check out?');
  }, [state, selectedColor, selectedSize, quantity, selectedVariant, designs, textColor, addMessage]);

  // ── Quick Actions ───────────────────────────────────────────────────────────

  const handleQuickAction = useCallback((action: string) => {
    setInput(action);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const suggestedActions = useCallback((): string[] => {
    const missing = getMissingFields(state);

    if (!state.product) {
      return ['Tee for a gift', 'Hoodie for my team', 'Tote bag for myself'];
    }
    if (!state.text && !state.icon) {
      const slogans = suggestSlogans(state.occasion, state.vibe);
      return slogans.slice(0, 4).map(s => `"${s}"`);
    }
    if (missing.length === 0) {
      return ['Add to cart', 'Change the color', 'Try a different text'];
    }
    return [];
  }, [state]);

  return {
    // Refs
    messagesEndRef,
    inputRef,
    // Router
    router,
    // State
    state,
    setState,
    input,
    setInput,
    isTyping,
    streamingText,
    fallbackNotice,
    cart,
    // Design
    designs,
    allDesigns,
    selectedVariant,
    setSelectedVariant,
    textOnlyVariant,
    buildTextOnlySVG,
    // Product options
    selectedColor,
    setSelectedColor,
    textColor,
    setTextColor,
    textColorAuto,
    setTextColorAuto,
    selectedSize,
    setSelectedSize,
    quantity,
    setQuantity,
    designScale,
    setDesignScale,
    designOffset,
    setDesignOffset,
    // Actions
    handleSend,
    handleAddToCart,
    handleQuickAction,
    suggestedActions,
    // Readiness
    showPreview: canPreview(state),
    isCartReady: canAddToCart(state),
    missingFields: getMissingFields(state),
    designsLoading
  };
}
