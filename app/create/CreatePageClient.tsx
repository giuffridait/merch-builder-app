'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, Send, Sparkles, Loader2, Check } from 'lucide-react';
import { PRODUCTS, PRINT_FEE, Product } from '@/lib/catalog';
import { findIconByKeyword, ICON_LIBRARY } from '@/lib/icons';
import { generateVariants, getContrastColor, DesignVariant } from '@/lib/design';
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
        content: "What would you like to make? A tee, hoodie, tote, or mug?",
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
  const requestTimeoutMs = 12000;

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
    const match = message.match(/(\d+)\s*(?:pcs|pieces|items|qty|quantity|shirts|hoodies|totes|mugs)?/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return Number.isNaN(value) ? null : value;
  };

  const isMaterialQuestion = (message: string) => {
    const text = message.toLowerCase();
    return text.includes('material') || text.includes('fabric');
  };

  const updateMessageContent = (id: string, append: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(message =>
        message.id === id ? { ...message, content: message.content + append } : message
      )
    }));
  };

  useEffect(() => {
    setCart(getCart());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => {
    if (state.product) {
      setSelectedColor(state.product.colors[0]);
      if (state.product.sizes) {
        setSelectedSize(state.product.sizes[2]); // Default to M
      }
    }
  }, [state.product]);

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
    if (!state.text || !state.product) return;
    const key = `${state.text}|${state.icon || 'default'}|${state.vibe || ''}|${state.occasion || ''}`;
    if (lastGeneratedRef.current === key) return;

    const icon = getIconById(state.icon) || ICON_LIBRARY.find(i => i.id === 'star') || ICON_LIBRARY[0];
    const generated = generateVariants(state.text, icon, state.vibe, state.occasion);
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
    const message: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);

    setIsTyping(true);

    const isAddToCartIntent = /add to cart|checkout|ready to buy|buy now/i.test(userMessage);

    if (state.product) {
      const responses: string[] = [];
      const mentionsText = /text|letters|word|phrase|font|print|design|logo/.test(userMessage.toLowerCase())
        || /"[^"]+"/.test(userMessage);
      const mentionsProductColor = /make it|make the|hoodie|tee|tote|bag|mug|shirt|color|colour/.test(
        userMessage.toLowerCase()
      );

      if (mentionsText) {
        const requestedTextColor = extractTextColor(userMessage);
        if (requestedTextColor) {
          setTextColor(requestedTextColor);
          setTextColorAuto(false);
          responses.push(`Text color set to ${requestedTextColor.name}.`);
        }
      }

      const colorRequest = extractRequestedColor(userMessage, state.product.colors);
      if (colorRequest && (!mentionsText || mentionsProductColor)) {
        if (colorRequest.match) {
          setSelectedColor(colorRequest.match);
          responses.push(`Got it — switching to ${colorRequest.match.name}.`);
        } else {
          responses.push(
            `We don’t have ${colorRequest.requested} for ${state.product.name}. Available colors: ${state.product.colors.map(c => c.name).join(', ')}.`
          );
          addMessage('assistant', responses.join(' '));
          setIsTyping(false);
          return;
        }
      }

      const sizeRequest = extractRequestedSize(userMessage, state.product.sizes);
      if (sizeRequest) {
        if (state.product.sizes?.includes(sizeRequest)) {
          setSelectedSize(sizeRequest);
          responses.push(`Size set to ${sizeRequest}.`);
        } else {
          responses.push(
            `That size isn’t available. Sizes: ${(state.product.sizes || []).join(', ')}.`
          );
          addMessage('assistant', responses.join(' '));
          setIsTyping(false);
          return;
        }
      }

      const qtyRequest = extractQuantity(userMessage);
      if (qtyRequest && qtyRequest > 0) {
        setQuantity(qtyRequest);
        responses.push(`Quantity set to ${qtyRequest}.`);
      }

      if (isMaterialQuestion(userMessage)) {
        responses.push('Materials are fixed for this product. You can choose color and size.');
        addMessage('assistant', responses.join(' '));
        setIsTyping(false);
        return;
      }

      if (responses.length > 0) {
        addMessage('assistant', responses.join(' '));
      }
    }

    if (isAddToCartIntent) {
      setIsTyping(false);
      if (!selectedColor || !state.text) {
        addMessage('assistant', 'To add to cart, please add a short text and choose a product color.');
        return;
      }
      handleAddToCart();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    const trimmedMessages = state.messages.map(m => ({ role: m.role, content: m.content }));
    let streamRes: Response;
    try {
      streamRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          state,
          stream: true,
          messages: trimmedMessages
        }),
        signal: controller.signal
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setIsTyping(false);
      addMessage('assistant', 'The AI is taking too long to respond. Please try again in a moment.');
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    const isStream = streamRes.ok && streamRes.headers.get('content-type')?.includes('text/event-stream');

    if (!isStream || !streamRes.body) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      let res: Response;
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage,
            state,
            messages: trimmedMessages
          }),
          signal: controller.signal
        });
      } catch (err: any) {
        clearTimeout(timeoutId);
        setIsTyping(false);
        addMessage('assistant', 'The AI is taking too long to respond. Please try again in a moment.');
        return;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        setIsTyping(false);
        addMessage('assistant', 'Sorry, I had trouble reaching the AI. Try again in a moment.');
        return;
      }

      const data = await res.json();
      setFallbackNotice(!!data.fallbackUsed);
      const updates = data.updates || {};

      if (state.stage === 'icon' && !updates.icon) {
        const icon = findIconByKeyword(userMessage);
        updates.icon = icon.id;
      }

      const newState = { ...state, ...updates };
      setState(newState);

      if (shouldGenerateDesigns(newState) || (newState.stage === 'icon' && newState.text && newState.icon)) {
        setIsTyping(false);
        addMessage('assistant', 'Perfect! Let me generate 3 design variants for you... ✨');
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const generated = generateVariants(
          newState.text!,
          findIconByKeyword(newState.icon!),
          newState.vibe,
          newState.occasion
        );
        
        setDesigns(generated.variants);
        setSelectedVariant(generated.recommended);
        
        setState(prev => ({ ...prev, stage: 'preview' }));
        addMessage('assistant', `I've created 3 designs for you! Variant ${generated.recommended} is my top recommendation based on your preferences. You can pick any variant, adjust colors and size, then add to cart.`);
        setIsTyping(false);
        return;
      }

      setIsTyping(false);
      addMessage('assistant', data.assistantMessage || "I'm here to help! What would you like to do?");
      return;
    }

    const assistantId = Date.now().toString();
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }
      ]
    }));

    setFallbackNotice(false);
    const decoder = new TextDecoder();
    const reader = streamRes.body.getReader();
    let buffer = '';
    let updates: any = {};
    let lastChunkAt = Date.now();

    const streamTimeout = setInterval(() => {
      if (Date.now() - lastChunkAt > requestTimeoutMs) {
        reader.cancel();
      }
    }, 1000);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      lastChunkAt = Date.now();
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
          try {
            const delta = JSON.parse(data);
            updateMessageContent(assistantId, typeof delta === 'string' ? delta : '');
          } catch {
            updateMessageContent(assistantId, data);
          }
        } else if (event === 'done') {
          try {
            const donePayload = JSON.parse(data);
            setFallbackNotice(!!donePayload?.fallbackUsed);
          } catch {
            setFallbackNotice(false);
          }
          const mergedUpdates = updates || {};
          if (state.stage === 'icon' && !mergedUpdates.icon) {
            const icon = findIconByKeyword(userMessage);
            mergedUpdates.icon = icon.id;
          }

          const newState = { ...state, ...mergedUpdates };
          setState(prev => ({ ...prev, ...mergedUpdates }));

          if (shouldGenerateDesigns(newState) || (newState.stage === 'icon' && newState.text && newState.icon)) {
            setIsTyping(false);
            addMessage('assistant', 'Perfect! Let me generate 3 design variants for you... ✨');
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const generated = generateVariants(
              newState.text!,
              findIconByKeyword(newState.icon!),
              newState.vibe,
              newState.occasion
            );
            
            setDesigns(generated.variants);
            setSelectedVariant(generated.recommended);
            
            setState(prev => ({ ...prev, stage: 'preview' }));
            addMessage('assistant', `I've created 3 designs for you! Variant ${generated.recommended} is my top recommendation based on your preferences. You can pick any variant, adjust colors and size, then add to cart.`);
            setIsTyping(false);
            return;
          }

          setIsTyping(false);
          clearInterval(streamTimeout);
          return;
        }
      }
    }

    clearInterval(streamTimeout);
    setIsTyping(false);
    addMessage('assistant', 'The AI is taking too long to respond. Please try again in a moment.');
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

  const handleAddToCart = () => {
    if (!state.product) return;
    if (!selectedColor || !state.text) {
      addMessage('assistant', 'Add a short text and choose a product color to add this to cart.');
      return;
    }

    const fallbackVariantId = designs?.[0]?.id || 'Text';
    const activeVariantId = selectedVariant || fallbackVariantId;
    const variant = designs?.find(v => v.id === activeVariantId);
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
        return ['Tee for a gift', 'Hoodie for my team', 'Tote bag for myself', 'Mug for a friend'];
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

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8 h-full">
          {/* Left: Chat */}
          <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {state.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] text-white'
                        : 'bg-[#f7f7f7] border border-[#e4e4e4]'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={16} className="text-[#e4002b]" />
                        <span className="text-xs text-[#6b6b6b]">AI Assistant</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
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

            {/* Quick Actions */}
            {suggestedActions().length > 0 && (
              <div className="mb-4">
                {fallbackNotice && (
                  <div className="mb-2 text-xs text-[#ffb14a]">
                    Using fallback mode (AI unavailable). Responses may be less flexible.
                  </div>
                )}
                <div className="text-xs text-[#6b6b6b] mb-2">Quick suggestions:</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedActions().map((action) => (
                    <button
                      key={action}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-1.5 text-xs bg-[#f7f7f7] hover:bg-[#efefef] border border-[#e4e4e4] rounded-full transition-all"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 bg-white border border-[#e4e4e4] rounded-xl focus:outline-none focus:border-[#e4002b] transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="px-6 py-3 bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <Send size={20} />
              </button>
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
                        __html: designs.find(v => v.id === selectedVariant)?.svg || ''
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
            {state.text && state.product && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-medium text-[#6b6b6b]">DESIGN VARIANTS</h3>
                <div className="text-xs text-[#6b6b6b]">
                  {designs
                    ? 'Pick a variant or skip to keep text‑only.'
                    : 'Add an icon to generate design variants, or continue with text‑only.'}
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {(designs || []).map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all ${
                        selectedVariant === variant.id
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
                      <div className="text-sm font-semibold">Variant {variant.id}</div>
                      <div className="text-xs text-[#6b6b6b] mt-1">{variant.name}</div>
                      <div className="text-xs text-[#6b6b6b] mt-2">Score {variant.score}/100</div>
                      {selectedVariant === variant.id && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-[#e4002b] font-semibold">
                          <Check size={14} />
                          Selected
                        </div>
                      )}
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
                          className={`w-12 h-12 rounded-full border-2 transition-all ${
                            selectedColor?.name === color.name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'
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
                            className={`w-10 h-10 rounded-full border-2 transition-all ${
                              textColor?.name === name ? 'border-[#e4002b]' : 'border-[#e4e4e4]'
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                            title={name}
                          />
                        );
                      })}
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
                            className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                              selectedSize === size
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
                    disabled={!selectedColor || !state.text}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={20} />
                    Add to Cart • €{((state.product!.basePrice + PRINT_FEE) * quantity).toFixed(2)}
                  </button>
                  {(!selectedColor || !state.text) && (
                    <div className="text-xs text-[#6b6b6b]">
                      Add a short text and choose a product color to enable add to cart.
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
    </div>
  );
}
