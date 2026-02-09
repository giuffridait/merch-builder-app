'use client';

import React, { RefObject } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Message } from '@/lib/agent';

interface ChatPanelProps {
  messages: Message[];
  isTyping: boolean;
  streamingText: string;
  fallbackNotice: boolean;
  suggestedActions: string[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (action: string) => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
}

export default function ChatPanel({
  messages,
  isTyping,
  streamingText,
  fallbackNotice,
  suggestedActions,
  input,
  onInputChange,
  onSend,
  onQuickAction,
  messagesEndRef,
  inputRef
}: ChatPanelProps) {
  return (
    <div className="bg-white border border-[#e4e4e4] rounded-2xl p-5 shadow-sm">
      {/* Messages */}
      <div className="space-y-3 max-h-[36vh] overflow-y-auto pr-1">
        {messages.map((message) => (
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
              {streamingText ? (
                <p className="text-sm leading-relaxed">{streamingText}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[#e4002b]" />
                  <span className="text-sm text-[#6b6b6b]">Thinking...</span>
                </div>
              )}
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
      {suggestedActions.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-[#6b6b6b] mb-2">Quick suggestions:</div>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <button
                key={action}
                onClick={() => onQuickAction(action)}
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
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSend()}
          placeholder="Type your message..."
          className="flex-1 px-4 py-3 bg-white border border-[#e4e4e4] rounded-2xl focus:outline-none focus:border-[#e4002b] transition-all text-sm"
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isTyping}
          className="px-6 py-3 bg-gradient-to-r from-[#e4002b] to-[#ff6b6b] rounded-2xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
