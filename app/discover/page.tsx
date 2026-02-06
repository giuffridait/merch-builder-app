'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PackageSearch, Send } from 'lucide-react';
import { Message } from '@/lib/agent';
import { DiscoverConstraints, DiscoverState, InventoryResult, parseConstraints, rankInventory } from '@/lib/discover';
import { addToCart } from '@/lib/cart';
import { getInventory } from '@/lib/inventory';

export default function DiscoverPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [lastResults, setLastResults] = useState<InventoryResult[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [selectedColorById, setSelectedColorById] = useState<Record<string, string>>({});
  const [selectedSizeById, setSelectedSizeById] = useState<Record<string, string>>({});
  const [selectedMaterialById, setSelectedMaterialById] = useState<Record<string, string>>({});
  const [imageErrorById, setImageErrorById] = useState<Record<string, boolean>>({});
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [optimisticPreview, setOptimisticPreview] = useState(false);

  const [state, setState] = useState<DiscoverState>({
    stage: 'welcome',
    constraints: {},
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Tell me what you need (budget, material, quantity, timing). I’ll shortlist the best products.",
      timestamp: Date.now()
    }
  ]);

  const inventoryById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getInventory>[number]>();
    for (const item of getInventory()) {
      map.set(item.item_id, item);
    }
    return map;
  }, []);

  const updateMessageContent = (id: string, append: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id ? { ...message, content: message.content + append } : message
      )
    );
  };

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role, content, timestamp: Date.now() }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);
    setHasInteracted(true);
    setIsTyping(true);

    const parsed = parseConstraints(userMessage);
    if (optimisticPreview) {
      const merged = { ...state.constraints, ...parsed };
      const seeded = buildResults(merged);
      if (seeded.length > 0) {
        setResults(seeded);
        setLastResults(seeded);
        setCarouselIndex(0);
        if (merged.color) {
          setSelectedColorById(prev => {
            const next = { ...prev };
            for (const item of seeded) {
              next[item.item_id] = merged.color!;
            }
            return next;
          });
        }
        if (merged.size) {
          setSelectedSizeById(prev => {
            const next = { ...prev };
            for (const item of seeded) {
              next[item.item_id] = merged.size!;
            }
            return next;
          });
        }
        if (merged.materials && merged.materials.length > 0) {
          setSelectedMaterialById(prev => {
            const next = { ...prev };
            for (const item of seeded) {
              next[item.item_id] = merged.materials![0];
            }
            return next;
          });
        }
      }
    }

    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, state, stream: true })
    });

    const isStream = res.ok && res.headers.get('content-type')?.includes('text/event-stream');
    const isBuyIntent = (text: string) => {
      const t = text.toLowerCase();
      return t.includes('ready to buy') || t.includes('buy now') || t.includes('add to cart') || t.includes('checkout');
    };

    if (!isStream || !res.body) {
      const fallback = await res.json();
      setFallbackNotice(!!fallback.fallbackUsed);
      const updates = fallback.updates as Partial<DiscoverConstraints & { stage?: DiscoverState['stage'] }>;
      setState(prev => ({
        ...prev,
        constraints: { ...prev.constraints, ...updates },
        stage: updates.stage || prev.stage
      }));
      setResults(fallback.results || []);
      setCarouselIndex(0);
      addMessage('assistant', fallback.assistantMessage || 'Here are the best matches.');
      if (isBuyIntent(userMessage) && (fallback.results || []).length > 0) {
        const top = fallback.results[0];
        const added = handleAddToCart(top);
        if (!added) {
          addMessage('assistant', 'Please confirm color and size before adding to cart.');
        }
      }
      setIsTyping(false);
      return;
    }

    const assistantId = Date.now().toString();
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }
    ]);

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = '';
    let updates: Partial<DiscoverConstraints & { stage?: DiscoverState['stage'] }> = {};
    let resultsFromStream: InventoryResult[] = [];

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
        } else if (event === 'results') {
          try {
            const items = JSON.parse(data) as InventoryResult[];
            resultsFromStream = items || [];
            setResults(resultsFromStream);
            if (resultsFromStream.length > 0) setLastResults(resultsFromStream);
            if (updates.color && resultsFromStream.length > 0) {
              setSelectedColorById(prev => {
                const next = { ...prev };
                for (const item of resultsFromStream) {
                  next[item.item_id] = updates.color!;
                }
                return next;
              });
            }
            if (updates.size && resultsFromStream.length > 0) {
              setSelectedSizeById(prev => {
                const next = { ...prev };
                for (const item of resultsFromStream) {
                  next[item.item_id] = updates.size!;
                }
                return next;
              });
            }
            if (updates.materials && updates.materials.length > 0 && resultsFromStream.length > 0) {
              setSelectedMaterialById(prev => {
                const next = { ...prev };
                for (const item of resultsFromStream) {
                  next[item.item_id] = updates.materials![0];
                }
                return next;
              });
            }
            setCarouselIndex(0);
          } catch {
            // keep existing results on parse failure
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

          setState(prev => ({
            ...prev,
            constraints: { ...prev.constraints, ...updates },
            stage: updates.stage || prev.stage
          }));
          if (resultsFromStream.length === 0) {
            const merged = { ...state.constraints, ...updates };
            const seeded = buildResults(merged);
            if (seeded.length > 0) {
              setResults(seeded);
              setLastResults(seeded);
              setCarouselIndex(0);
              resultsFromStream = seeded;
              if (merged.color) {
                setSelectedColorById(prev => {
                  const next = { ...prev };
                  for (const item of seeded) {
                    next[item.item_id] = merged.color!;
                  }
                  return next;
                });
              }
              if (merged.size) {
                setSelectedSizeById(prev => {
                  const next = { ...prev };
                  for (const item of seeded) {
                    next[item.item_id] = merged.size!;
                  }
                  return next;
                });
              }
              if (merged.materials && merged.materials.length > 0) {
                setSelectedMaterialById(prev => {
                  const next = { ...prev };
                  for (const item of seeded) {
                    next[item.item_id] = merged.materials![0];
                  }
                  return next;
                });
              }
            }
          }
          if (isBuyIntent(userMessage) && resultsFromStream.length > 0) {
            const top = resultsFromStream[0];
            const added = handleAddToCart(top);
            if (!added) {
              addMessage('assistant', 'Please confirm color and size before adding to cart.');
            }
          }
          setIsTyping(false);
          return;
        }
      }
    }
  };

  const handleAddToCart = (item: InventoryResult) => {
    const inventoryItem = inventoryById.get(item.item_id);
    if (!inventoryItem) return false;

    const colors = inventoryItem.attributes.variants.colors || [];
    const selectedColorName = selectedColorById[item.item_id] || item.matchedColor;
    const selectedColor = colors.find(c => c.name === selectedColorName);
    if (!selectedColor && colors.length > 0) return false;

    const sizes = inventoryItem.attributes.variants.sizes || [];
    const selectedSize = sizes.length > 0
      ? (selectedSizeById[item.item_id] || (sizes.includes('M') ? 'M' : sizes[0]))
      : null;
    if (sizes.length > 0 && !selectedSize) return false;

    const price = inventoryItem.price.amount;
    addToCart({
      productId: inventoryItem.item_id,
      productName: inventoryItem.title,
      color: selectedColor || { name: 'Default', hex: '#111111' },
      size: selectedSize,
      quantity: 1,
      variant: 'inventory',
      designSVG: '',
      text: 'No design',
      icon: 'none',
      price,
      total: price,
      currency: inventoryItem.price.currency,
      deliveryEstimateDays: inventoryItem.attributes.lead_time_days
    });
    setAddedItemId(item.item_id);
    return true;
  };

  const quickSuggestions = () => {
    if (state.stage === 'welcome') {
      return ['Team tees under €40', 'Sustainable white tote', 'Gift under €25', 'Hoodie for a team'];
    }
    return ['Under €30', 'Organic cotton', 'Need 20 pieces', 'White tote'];
  };

  const buildResults = (base: Partial<DiscoverConstraints>) => {
    const strict = rankInventory(base);
    if (strict.length > 0) return strict;
    const relaxedColor = { ...base };
    delete relaxedColor.color;
    const noColor = rankInventory(relaxedColor);
    if (noColor.length > 0) return noColor;
    const relaxedMaterials = { ...relaxedColor };
    delete relaxedMaterials.materials;
    const noMaterials = rankInventory(relaxedMaterials);
    if (noMaterials.length > 0) return noMaterials;
    const relaxedLead = { ...relaxedMaterials };
    delete relaxedLead.leadTimeMax;
    const noLead = rankInventory(relaxedLead);
    if (noLead.length > 0) return noLead;
    return [];
  };

  useEffect(() => {
    if (!hasInteracted && results.length === 0) {
      const seeded = rankInventory({ category: 'tee', color: 'white' });
      if (seeded.length > 0) {
        setResults(seeded);
        setLastResults(seeded);
        setCarouselIndex(0);
      }
    }
  }, [hasInteracted, results.length]);

  return (
    <main className="min-h-screen bg-[#ffffff] text-[#111111]">
      <div className="max-w-6xl mx-auto px-6 py-10 pb-40">
        <header className="flex items-center justify-between mb-8">
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

        <div className="grid lg:grid-cols-[360px_1fr] gap-10">
          <div className="flex flex-col">
            <div className="bg-[#ffffff] border border-[#e4e4e4] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <PackageSearch className="text-[#e4002b]" />
                  <h1 className="text-lg font-semibold">Inventory Companion</h1>
                </div>
                <label className="flex items-center gap-2 text-xs text-[#6b6b6b]">
                  <span>Optimistic preview</span>
                  <input
                    type="checkbox"
                    checked={optimisticPreview}
                    onChange={(e) => setOptimisticPreview(e.target.checked)}
                    className="h-4 w-4 rounded border-[#e4e4e4] text-[#e4002b] focus:ring-[#e4002b]"
                  />
                </label>
              </div>

              <div className="space-y-3 max-h-[36vh] overflow-y-auto pr-1">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] text-white'
                          : 'bg-[#f7f7f7] border border-[#e4e4e4]'
                      }`}
                    >
                      <p className="leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="text-xs text-[#6b6b6b]">Thinking...</div>
                )}
              </div>

              {fallbackNotice && (
                <div className="mt-3 text-xs text-[#e4002b]">
                  Using fallback mode (AI unavailable). Responses may be less flexible.
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {quickSuggestions().map(action => (
                  <button
                    key={action}
                    onClick={() => {
                      setInput(action);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    className="px-2.5 py-1 text-xs bg-[#f7f7f7] hover:bg-[#efefef] border border-[#e4e4e4] rounded-full transition-all"
                  >
                    {action}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Tell me what you need..."
                  className="flex-1 px-3 py-2 bg-white border border-[#e4e4e4] rounded-xl focus:outline-none focus:border-[#e4002b] transition-all text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="px-4 py-2 bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:pl-4">
            <div className="bg-[#ffffff] border border-[#e4e4e4] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-[#888] uppercase tracking-wide">Recommended</div>
                  <h2 className="text-xl font-semibold">Top Pick</h2>
                  <div className="mt-1 inline-flex items-center gap-2 text-xs text-[#6b6b6b] bg-[#f7f7f7] border border-[#e4e4e4] rounded-full px-2 py-0.5">
                    AI‑ranked
                  </div>
                </div>
                {results.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCarouselIndex((prev) => (prev - 1 + results.length) % results.length)}
                      className="px-4 py-2 text-xs border border-[#e4e4e4] rounded-full bg-[#e4002b] text-white hover:opacity-90"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setCarouselIndex((prev) => (prev + 1) % results.length)}
                      className="px-4 py-2 text-xs border border-[#e4e4e4] rounded-full bg-[#e4002b] text-white hover:opacity-90"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              {((results.length === 0) && (lastResults.length === 0)) ? (
                <div className="text-sm text-[#6b6b6b]">
                  Share your constraints to see recommendations.
                </div>
              ) : (
                <div className="border border-[#e4e4e4] rounded-xl p-4 bg-[#f7f7f7]">
                  {(() => {
                    const activeResults = results.length > 0 ? results : lastResults;
                    const item = activeResults[carouselIndex % activeResults.length];
                    if (!item) return null;
                    const inventoryItem = inventoryById.get(item.item_id);
                    const selectedColor = selectedColorById[item.item_id] || item.matchedColor;
                    const selectedMaterial =
                      selectedMaterialById[item.item_id] ||
                      item.matchedMaterial ||
                      inventoryItem?.attributes.materials[0];
                    const variantKey =
                      selectedColor && selectedMaterial
                        ? `${selectedColor.toLowerCase()}|${selectedMaterial.toLowerCase()}`.replace(/\s+/g, '-')
                        : null;
                    const variantImage =
                      variantKey && inventoryItem?.image_url_by_variant
                        ? inventoryItem.image_url_by_variant[variantKey]
                        : undefined;

                    return (
                      <div>
                        <div className="w-full h-[520px] rounded-2xl border border-[#e4e4e4] bg-white overflow-hidden flex items-center justify-center mb-5 relative">
                          <img
                            src={
                              imageErrorById[item.item_id]
                                ? (item.image_url_fallback || item.image_url)
                                : (variantImage || item.image_url_selected || item.image_url_fallback || item.image_url)
                            }
                            alt={item.title}
                            className="w-full h-full object-contain p-6"
                            onError={() =>
                              setImageErrorById(prev => ({ ...prev, [item.item_id]: true }))
                            }
                          />
                          <div className="absolute top-3 right-3 group">
                            <div className="w-7 h-7 rounded-full bg-white border border-[#e4e4e4] text-[#6b6b6b] flex items-center justify-center text-xs font-semibold cursor-help">
                              i
                            </div>
                            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-[#e4e4e4] bg-white p-3 text-xs text-[#6b6b6b] shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                              <div className="mb-1">{item.description}</div>
                              <div className="mb-1">Why: {item.reason}</div>
                              <div className="mb-1">Lead time: {item.leadTimeDays} days · Availability: {item.availability}</div>
                              {(() => {
                                const inventoryItem = inventoryById.get(item.item_id);
                                if (!inventoryItem) return null;
                                const materials = inventoryItem.attributes.materials.join(', ');
                                const colors = inventoryItem.attributes.variants.colors.map(c => c.name).join(', ');
                                const sizes = inventoryItem.attributes.variants.sizes.length > 0
                                  ? inventoryItem.attributes.variants.sizes.join(', ')
                                  : 'One size';
                                return (
                                  <>
                                    <div className="mb-1">Materials: {materials}</div>
                                    <div className="mb-1">Colors: {colors}</div>
                                    <div className="mb-1">Sizes: {sizes}</div>
                                    <div className="mb-1">Min qty: {inventoryItem.attributes.min_qty}</div>
                                    <div className="mb-1">Lead time: {inventoryItem.attributes.lead_time_days} days</div>
                                  </>
                                );
                              })()}
                              <div>Tags: {item.tags.join(', ')}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-6 px-1">
                          <div className="flex-1">
                            <div className="text-lg font-semibold">{item.title}</div>
                            <div className="text-sm text-[#6b6b6b]">Essential fit · Limited stock</div>
                            <div className="text-xs text-[#6b6b6b] mt-2">
                              {item.reason}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">{item.price}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-4 items-center px-1">
                          {(() => {
                            const inventoryItem = inventoryById.get(item.item_id);
                            if (!inventoryItem) return null;
                            const colors = inventoryItem.attributes.variants.colors || [];
                            const sizes = inventoryItem.attributes.variants.sizes || [];
                            const materials = inventoryItem.attributes.materials || [];
                            return (
                              <div className="flex flex-wrap gap-3 items-center">
                                {materials.length > 1 && (
                                  <label className="text-xs text-[#6b6b6b]">
                                    Material
                                    <select
                                      value={selectedMaterialById[item.item_id] || materials[0]}
                                      onChange={(e) =>
                                        setSelectedMaterialById(prev => ({ ...prev, [item.item_id]: e.target.value }))
                                      }
                                      className="ml-2 px-2 py-1 rounded-md border border-[#e4e4e4] bg-white text-xs"
                                    >
                                      {materials.map(material => (
                                        <option key={material} value={material}>
                                          {material}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                {colors.length > 0 && (
                                  <label className="text-xs text-[#6b6b6b]">
                                    Color
                                    <select
                                      value={selectedColorById[item.item_id] || item.matchedColor || colors[0].name}
                                      onChange={(e) =>
                                        setSelectedColorById(prev => ({ ...prev, [item.item_id]: e.target.value }))
                                      }
                                      className="ml-2 px-2 py-1 rounded-md border border-[#e4e4e4] bg-white text-xs"
                                    >
                                      {colors.map(color => (
                                        <option key={color.name} value={color.name}>
                                          {color.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                {sizes.length > 0 && (
                                  <label className="text-xs text-[#6b6b6b]">
                                    Size
                                    <select
                                      value={selectedSizeById[item.item_id] || (sizes.includes('M') ? 'M' : sizes[0])}
                                      onChange={(e) =>
                                        setSelectedSizeById(prev => ({ ...prev, [item.item_id]: e.target.value }))
                                      }
                                      className="ml-2 px-2 py-1 rounded-md border border-[#e4e4e4] bg-white text-xs"
                                    >
                                      {sizes.map(size => (
                                        <option key={size} value={size}>
                                          {size}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                              </div>
                            );
                          })()}
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#111111] text-white hover:opacity-90 transition-all text-sm font-semibold"
                          >
                            Add to Cart
                          </button>
                          <Link
                            href={`/create?product=${item.item_id}`}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] hover:opacity-90 transition-all text-sm font-semibold"
                          >
                            Customize
                          </Link>
                          {addedItemId === item.item_id && (
                            <Link
                              href="/cart"
                              className="text-xs text-[#6b6b6b] hover:text-[#111111] transition-colors"
                            >
                              Added. View cart →
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
