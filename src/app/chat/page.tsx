'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, Bot, User, Sparkles, RotateCcw, ArrowRight } from 'lucide-react';
import { QUICK_ACTIONS, GREETING_MESSAGE } from '@/lib/ai/prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    resultCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function formatTime(date: Date) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

// Parse bold **text** to <strong>
function renderMarkdown(text: string) {
    // Split on **bold** markers
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

// Render multi-line message with markdown
function MessageContent({ text }: { text: string }) {
    return (
        <div className="chat-message-text">
            {text.split('\n').map((line, i) => (
                <p key={i} className={line.trim() === '' ? 'chat-line-gap' : ''}>
                    {renderMarkdown(line)}
                </p>
            ))}
        </div>
    );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
    return (
        <div className="chat-bubble chat-bubble-ai chat-typing animate-fade-up">
            <div className="chat-avatar chat-avatar-ai">
                <Bot size={18} />
            </div>
            <div className="chat-bubble-body chat-bubble-body-ai">
                <div className="typing-dots">
                    <span /><span /><span />
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: uid(),
            role: 'assistant',
            content: GREETING_MESSAGE,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(true);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Hide quick actions once the user sends a message
    useEffect(() => {
        const userMessages = messages.filter((m) => m.role === 'user');
        if (userMessages.length > 0) setShowQuickActions(false);
    }, [messages]);

    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isLoading) return;

            const userMsg: ChatMessage = {
                id: uid(),
                role: 'user',
                content: trimmed,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, userMsg]);
            setInput('');
            setIsLoading(true);

            // Build history for the API (exclude the initial greeting)
            const history = messages
                .filter((m) => m.id !== messages[0].id)
                .map((m) => ({ role: m.role, content: m.content }));

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: trimmed, history }),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `שגיאת שרת ${res.status}`);
                }

                const data = await res.json();

                setMessages((prev) => [
                    ...prev,
                    {
                        id: uid(),
                        role: 'assistant',
                        content: data.response,
                        timestamp: new Date(),
                        resultCount: data.resultCount,
                    },
                ]);
            } catch (err: unknown) {
                const errorMessage =
                    err instanceof Error ? err.message : 'אירעה שגיאה, נסה שוב.';
                setMessages((prev) => [
                    ...prev,
                    {
                        id: uid(),
                        role: 'assistant',
                        content: `😕 ${errorMessage}`,
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setIsLoading(false);
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        },
        [messages, isLoading],
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const handleReset = () => {
        setMessages([
            {
                id: uid(),
                role: 'assistant',
                content: GREETING_MESSAGE,
                timestamp: new Date(),
            },
        ]);
        setShowQuickActions(true);
        setInput('');
        inputRef.current?.focus();
    };

    return (
        <div className="chat-page">
            {/* ── Header ── */}
            <header className="chat-header">
                <div className="chat-header-inner">
                    <Link href="/" className="chat-back-btn">
                        <ArrowRight size={18} />
                        <span>חזרה</span>
                    </Link>

                    <div className="chat-header-brand">
                        <div className="chat-header-avatar">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="chat-header-title">מתני 🤖</div>
                            <div className="chat-header-subtitle">נציג חכם של המתנ&quot;ס</div>
                        </div>
                    </div>

                    <button
                        className="chat-reset-btn"
                        onClick={handleReset}
                        title="התחל שיחה חדשה"
                        aria-label="התחל שיחה חדשה"
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>
            </header>

            {/* ── Messages area ── */}
            <main className="chat-messages" role="log" aria-live="polite" aria-label="שיחה">
                {/* Quick action chips */}
                {showQuickActions && (
                    <div className="chat-quick-actions animate-fade-up">
                        <p className="chat-quick-label">שאל אותי למשל:</p>
                        <div className="chat-quick-grid">
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.message}
                                    className="chat-quick-chip"
                                    onClick={() => sendMessage(action.message)}
                                    disabled={isLoading}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg, idx) => (
                    <div
                        key={msg.id}
                        className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'} animate-fade-up`}
                        style={{ animationDelay: `${Math.min(idx * 0.05, 0.3)}s` }}
                    >
                        {msg.role === 'assistant' && (
                            <div className="chat-avatar chat-avatar-ai" aria-hidden="true">
                                <Bot size={18} />
                            </div>
                        )}

                        <div className={`chat-bubble-body ${msg.role === 'user' ? 'chat-bubble-body-user' : 'chat-bubble-body-ai'}`}>
                            <MessageContent text={msg.content} />
                            <div className="chat-bubble-meta">
                                {msg.resultCount !== undefined && msg.resultCount > 0 && (
                                    <span className="chat-result-badge">
                                        {msg.resultCount} תוצאות
                                    </span>
                                )}
                                <time className="chat-time">{formatTime(msg.timestamp)}</time>
                            </div>
                        </div>

                        {msg.role === 'user' && (
                            <div className="chat-avatar chat-avatar-user" aria-hidden="true">
                                <User size={18} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Typing indicator */}
                {isLoading && <TypingIndicator />}

                <div ref={bottomRef} aria-hidden="true" />
            </main>

            {/* ── Input area ── */}
            <footer className="chat-input-area">
                <form className="chat-input-form" onSubmit={handleSubmit}>
                    <textarea
                        ref={inputRef}
                        id="chat-input"
                        className="chat-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="שאל אותי כל דבר על המתנ&quot;ס... (Enter לשליחה)"
                        rows={1}
                        maxLength={500}
                        disabled={isLoading}
                        aria-label="הקלד שאלה"
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        className="chat-send-btn"
                        disabled={isLoading || !input.trim()}
                        aria-label="שלח הודעה"
                        id="chat-send-button"
                    >
                        <Send size={20} />
                    </button>
                </form>
                <p className="chat-hint">מוגן על ידי AI · מתני עונה רק על שאלות הקשורות למתנ&quot;ס</p>
            </footer>
        </div>
    );
}
