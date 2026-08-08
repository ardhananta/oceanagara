'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/app/types/maritime';

interface AgentChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  locationReady: boolean;
  onStartAnalysis: () => void;
}

export default function AgentChat({
  messages,
  isLoading,
  onSend,
  inputValue,
  onInputChange,
  locationReady,
  onStartAnalysis,
}: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && !isLoading) {
      e.preventDefault();
      onSend(inputValue.trim());
    }
  };

  const quickReplies = [
    'Laut Jawa pesisir Semarang',
    'Teluk Jakarta',
    'Selat Makassar',
    'Perairan Bali',
    'Laut Banda',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Agent header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0d1b2e] animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Aruna</p>
          <p className="text-[11px] text-sky-300/80">AI Information Gatherer • Online</p>
        </div>
        {locationReady && (
          <div className="ml-auto flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            Lokasi terdeteksi
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
        {messages.filter(m => m.role !== 'system').map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                  <span className="text-white text-[10px] font-bold">A</span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                isUser
                  ? 'bg-sky-500 text-white rounded-br-sm'
                  : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/8'
              }`}>
                {msg.content.split('**').map((part, j) =>
                  j % 2 === 1
                    ? <strong key={j} className={isUser ? 'text-white' : 'text-sky-300'}>{part}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <div className="bg-white/8 border border-white/8 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick replies — only show when no location yet */}
      {!locationReady && messages.length <= 2 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {quickReplies.map(q => (
            <button
              key={q}
              onClick={() => onSend(q)}
              disabled={isLoading}
              className="px-3 py-1.5 text-[11px] font-semibold text-sky-300 border border-sky-400/30 rounded-full hover:bg-sky-400/10 hover:border-sky-400/60 transition-all disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* CTA when location ready */}
      {locationReady && (
        <div className="px-5 pb-4 pt-2">
          <button
            onClick={onStartAnalysis}
            className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
            Mulai Analisis Risiko
          </button>
        </div>
      )}

      {/* Input */}
      {!locationReady && (
        <div className="px-5 pb-5 pt-1">
          <div className="flex items-center gap-2 bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 focus-within:border-sky-400/50 transition-colors">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ketik lokasi perairan yang ingin dianalisis…"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => inputValue.trim() && !isLoading && onSend(inputValue.trim())}
              disabled={!inputValue.trim() || isLoading}
              className="w-8 h-8 bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 text-white rounded-lg flex items-center justify-center transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
