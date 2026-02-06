'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, Send, Sparkles, Loader2, Check } from 'lucide-react';
import { PRODUCTS, PRINT_FEE, Product } from '@/lib/catalog';
import { findIconByKeyword } from '@/lib/icons';
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
        content: "Hey! 👋 I'm here to help you create custom merch. Let's start simple - what would you like to make? Just tell me like: \"I want a tee for my friend's birthday\" or \"Hoodie for my running team.\"",
        timestamp: Date.now()
      }
    ]
  });

  const [designs, setDesigns] = useState<DesignVariant[] | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const requestTimeoutMs = 12000;

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
      addMessage('assistant', 'The AI is taking too long to respond. Please make sure Ollama is running, then try again.');
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
        addMessage('assistant', 'The AI is taking too long to respond. Please make sure Ollama is running, then try again.');
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
    addMessage('assistant', 'The AI is taking too long to respond. Please make sure Ollama is running, then try again.');
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleAddToCart = () => {
    if (!state.product || !designs || !selectedVariant || !selectedColor) return;

    const variant = designs.find(v => v.id === selectedVariant);
    if (!variant) return;

    const itemPrice = state.product.basePrice + PRINT_FEE;
    
    const newCart = addToCart({
      productId: state.product.id,
      productName: state.product.name,
      color: selectedColor,
      size: selectedSize,
      quantity,
      variant: selectedVariant,
      designSVG: variant.svg,
      text: state.text!,
      icon: state.icon!,
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-lg" />
            <span className="text-xl font-bold tracking-tight">MerchForge</span>
          </div>
          
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
              <h3 className="text-sm font-medium text-[#6b6b6b] mb-4">LIVE PREVIEW</h3>
              
              {state.product ? (
                <div className="relative aspect-square bg-gradient-to-br from-[#f7f7f7] to-[#ffffff] rounded-xl overflow-hidden border border-[#e4e4e4]">
                  {/* Product mockup */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center text-9xl opacity-20"
                    style={{ color: selectedColor?.hex }}
                  >
                    {state.product.emoji}
                  </div>
                  
                  {/* Design overlay */}
                  {designs && selectedVariant && (
                    <div
                      className="absolute"
                      style={{
                        left: `${state.product.printArea.x}%`,
                        top: `${state.product.printArea.y}%`,
                        width: `${state.product.printArea.w}%`,
                        height: `${state.product.printArea.h}%`,
                        color: getContrastColor(selectedColor?.hex || '#ffffff')
                      }}
                      dangerouslySetInnerHTML={{
                        __html: designs.find(v => v.id === selectedVariant)?.svg || ''
                      }}
                    />
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
                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6b6b6b]">Product</span>
                    <span className="font-medium">{state.product.name}</span>
                  </div>
                  {selectedColor && (
                    <div className="flex justify-between">
                      <span className="text-[#6b6b6b]">Color</span>
                      <span className="font-medium">{selectedColor.name}</span>
                    </div>
                  )}
                  {selectedSize && (
                    <div className="flex justify-between">
                      <span className="text-[#6b6b6b]">Size</span>
                      <span className="font-medium">{selectedSize}</span>
                    </div>
                  )}
                  {state.text && (
                    <div className="flex justify-between">
                      <span className="text-[#6b6b6b]">Text</span>
                      <span className="font-medium">"{state.text}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Design Variants */}
            {designs && state.stage === 'preview' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-medium text-[#6b6b6b]">CHOOSE VARIANT</h3>
                <div className="space-y-2">
                  {designs.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        selectedVariant === variant.id
                          ? 'bg-[#f7f7f7] border-[#e4002b]'
                          : 'bg-white border-transparent hover:border-[#e4e4e4]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-sm mb-1">
                            Variant {variant.id}: {variant.name}
                          </div>
                          <div className="text-xs text-[#6b6b6b] mb-2">{variant.reasoning}</div>
                          <div className="text-xs text-[#6b6b6b]">Score: {variant.score}/100</div>
                        </div>
                        {selectedVariant === variant.id && (
                          <Check size={20} className="text-[#e4002b] flex-shrink-0 ml-2" />
                        )}
                      </div>
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
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all font-bold text-lg flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    Add to Cart • €{((state.product!.basePrice + PRINT_FEE) * quantity).toFixed(2)}
                  </button>
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
