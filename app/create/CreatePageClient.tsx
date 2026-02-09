'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCreateFlow } from './hooks/useCreateFlow';
import ChatPanel from './components/ChatPanel';
import PreviewPanel from './components/PreviewPanel';
import DesignPicker from './components/DesignPicker';
import OptionsPanel from './components/OptionsPanel';

export default function CreatePage() {
  const flow = useCreateFlow();

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#111111] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#e4e4e4]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => flow.router.push('/')}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#e4002b] to-[#ff6b6b] rounded-lg" />
            <span className="text-xl font-bold tracking-tight">MerchForge</span>
          </button>

          <button
            onClick={() => flow.router.push('/cart')}
            className="relative px-4 py-2 rounded-full bg-[#f7f7f7] hover:bg-[#efefef] transition-all flex items-center gap-2 border border-[#e4e4e4]"
          >
            <ShoppingCart size={20} />
            {flow.cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#e4002b] rounded-full text-xs flex items-center justify-center font-bold">
                {flow.cart.length}
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
            <ChatPanel
              messages={flow.state.messages}
              isTyping={flow.isTyping}
              streamingText={flow.streamingText}
              fallbackNotice={flow.fallbackNotice}
              suggestedActions={flow.suggestedActions()}
              input={flow.input}
              onInputChange={flow.setInput}
              onSend={flow.handleSend}
              onQuickAction={flow.handleQuickAction}
              messagesEndRef={flow.messagesEndRef}
              inputRef={flow.inputRef}
            />
          </div>

          {/* Right: Preview + Design + Options */}
          <div className="flex flex-col">
            <PreviewPanel
              product={flow.state.product}
              selectedColor={flow.selectedColor}
              textColor={flow.textColor}
              allDesigns={flow.allDesigns}
              selectedVariant={flow.selectedVariant}
              designScale={flow.designScale}
              designOffset={flow.designOffset}
              text={flow.state.text}
              selectedSize={flow.selectedSize}
            />

            {(flow.state.text || flow.state.icon) && flow.state.product && (
              <>
                <DesignPicker
                  designs={flow.allDesigns}
                  selectedVariant={flow.selectedVariant}
                  onSelect={flow.setSelectedVariant}
                  selectedColorHex={flow.selectedColor?.hex || '#ffffff'}
                  loading={flow.designsLoading}
                />

                <OptionsPanel
                  product={flow.state.product}
                  selectedColor={flow.selectedColor}
                  onColorSelect={flow.setSelectedColor}
                  textColor={flow.textColor}
                  onTextColorSelect={(color) => {
                    flow.setTextColor(color);
                    flow.setTextColorAuto(false);
                  }}
                  icon={flow.state.icon}
                  onIconSelect={(iconId) => flow.setState(prev => ({ ...prev, icon: iconId }))}
                  designScale={flow.designScale}
                  onScaleChange={flow.setDesignScale}
                  designOffset={flow.designOffset}
                  onOffsetChange={flow.setDesignOffset}
                  selectedSize={flow.selectedSize}
                  onSizeSelect={flow.setSelectedSize}
                  quantity={flow.quantity}
                  onQuantityChange={flow.setQuantity}
                  isCartReady={flow.isCartReady}
                  onAddToCart={flow.handleAddToCart}
                  hasDesign={!!(flow.state.text || flow.state.icon)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
