'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, Bot, User, Sparkles, RotateCcw, ArrowRight, Clock, MapPin, Users, BadgeDollarSign } from 'lucide-react';
import { QUICK_ACTIONS, GREETING_MESSAGE } from '@/lib/ai/chat-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityCard {
    id: string;
    title_he: string;
    description_he?: string | null;
    days_of_week?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    price?: number | null;
    location?: string | null;
    min_age?: number | null;
    max_age?: number | null;
    instructor_name?: string | null;
    max_participants?: number | null;
    current_participants?: number | null;
    categories?: { name_he: string } | null;
}

interface EventCard {
    id: string;
    title: string;
    description?: string | null;
    event_date: string;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    type?: string | null;
    category?: string | null;
    max_attendees?: number | null;
    current_attendees?: number | null;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    resultCount?: number;
    activityCards?: ActivityCard[];
    eventCards?: EventCard[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function formatTime(date: Date) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatEventDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Parse **bold** → <strong>
function renderMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

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

// ─── Result Cards ─────────────────────────────────────────────────────────────

function ActivityResultCard({ activity, index }: { activity: ActivityCard; index: number }) {
    const spotsLeft =
        activity.max_participants != null
            ? activity.max_participants - (activity.current_participants ?? 0)
            : null;

    const isFull = spotsLeft !== null && spotsLeft <= 0;

    return (
        <div
            className="result-card animate-fade-up"
            style={{ animationDelay: `${index * 0.07}s` }}
        >
            <div className="result-card-header">
                <div className="result-card-category">{activity.categories?.name_he ?? 'חוג'}</div>
                <div className={`result-card-spots ${isFull ? 'spots-full' : spotsLeft !== null && spotsLeft < 5 ? 'spots-low' : 'spots-ok'}`}>
                    {isFull ? 'מלא' : spotsLeft !== null ? `${spotsLeft} מקומות` : 'פתוח'}
                </div>
            </div>

            <h4 className="result-card-title">{activity.title_he}</h4>

            {activity.description_he && (
                <p className="result-card-desc">{activity.description_he}</p>
            )}

            <div className="result-card-meta">
                {activity.days_of_week && (
                    <span className="meta-item">
                        <Clock size={12} />
                        {activity.days_of_week}
                        {activity.start_time && ` ${activity.start_time.slice(0, 5)}`}
                        {activity.end_time && `–${activity.end_time.slice(0, 5)}`}
                    </span>
                )}
                {activity.location && (
                    <span className="meta-item">
                        <MapPin size={12} />
                        {activity.location}
                    </span>
                )}
                {(activity.min_age != null || activity.max_age != null) && (
                    <span className="meta-item">
                        <Users size={12} />
                        גיל {activity.min_age ?? 0}–{activity.max_age ?? '+'}
                    </span>
                )}
                {activity.price != null && (
                    <span className="meta-item meta-price">
                        <BadgeDollarSign size={12} />
                        {activity.price === 0 ? 'חינם' : `${activity.price}/חודש`}
                    </span>
                )}
            </div>

            {activity.instructor_name && (
                <div className="result-card-instructor">מדריך: {activity.instructor_name}</div>
            )}
        </div>
    );
}

function EventResultCard({ event, index }: { event: EventCard; index: number }) {
    const spotsLeft =
        event.max_attendees != null
            ? event.max_attendees - (event.current_attendees ?? 0)
            : null;

    return (
        <div
            className="result-card result-card-event animate-fade-up"
            style={{ animationDelay: `${index * 0.07}s` }}
        >
            <div className="result-card-header">
                <div className="result-card-category">{event.category ?? 'אירוע'}</div>
                {event.type && (
                    <div className="result-card-type">{event.type === 'זום' ? '🔗 זום' : '📍 פיזי'}</div>
                )}
            </div>

            <h4 className="result-card-title">{event.title}</h4>

            {event.description && (
                <p className="result-card-desc">{event.description}</p>
            )}

            <div className="result-card-meta">
                <span className="meta-item meta-date">
                    📅 {formatEventDate(event.event_date)}
                </span>
                {event.start_time && (
                    <span className="meta-item">
                        <Clock size={12} />
                        {event.start_time.slice(0, 5)}
                        {event.end_time && `–${event.end_time.slice(0, 5)}`}
                    </span>
                )}
                {event.location && (
                    <span className="meta-item">
                        <MapPin size={12} />
                        {event.location}
                    </span>
                )}
                {spotsLeft !== null && (
                    <span className="meta-item">
                        <Users size={12} />
                        {spotsLeft} מקומות פנויים
                    </span>
                )}
            </div>
        </div>
    );
}

function ResultCardsSection({ message }: { message: ChatMessage }) {
    const hasActivities = message.activityCards && message.activityCards.length > 0;
    const hasEvents = message.eventCards && message.eventCards.length > 0;

    if (!hasActivities && !hasEvents) return null;

    return (
        <div className="result-cards-section">
            {hasActivities && (
                <>
                    <p className="result-cards-label">🎨 חוגים ופעילויות שנמצאו:</p>
                    <div className="result-cards-grid">
                        {message.activityCards!.map((a, i) => (
                            <ActivityResultCard key={a.id} activity={a} index={i} />
                        ))}
                    </div>
                </>
            )}
            {hasEvents && (
                <>
                    <p className="result-cards-label" style={{ marginTop: hasActivities ? '1rem' : 0 }}>
                        📅 אירועים שנמצאו:
                    </p>
                    <div className="result-cards-grid">
                        {message.eventCards!.map((e, i) => (
                            <EventResultCard key={e.id} event={e} index={i} />
                        ))}
                    </div>
                </>
            )}
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

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize textarea
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [input]);

    // Hide quick actions after first user message
    useEffect(() => {
        if (messages.some((m) => m.role === 'user')) setShowQuickActions(false);
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

            // History excludes the initial greeting
            const history = messages
                .filter((_, i) => i > 0)
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
                        activityCards: data.activityCards ?? [],
                        eventCards: data.eventCards ?? [],
                    },
                ]);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'אירעה שגיאה, נסה שוב.';
                setMessages((prev) => [
                    ...prev,
                    {
                        id: uid(),
                        role: 'assistant',
                        content: `😕 ${msg}`,
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
        setTimeout(() => inputRef.current?.focus(), 50);
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
                        id="chat-reset-button"
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>
            </header>

            {/* ── Messages ── */}
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
                    <div key={msg.id}>
                        <div
                            className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'} animate-fade-up`}
                            style={{ animationDelay: `${Math.min(idx * 0.04, 0.25)}s` }}
                        >
                            {msg.role === 'assistant' && (
                                <div className="chat-avatar chat-avatar-ai" aria-hidden="true">
                                    <Bot size={18} />
                                </div>
                            )}

                            <div
                                className={`chat-bubble-body ${msg.role === 'user' ? 'chat-bubble-body-user' : 'chat-bubble-body-ai'}`}
                            >
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

                        {/* Result cards below AI message */}
                        {msg.role === 'assistant' && <ResultCardsSection message={msg} />}
                    </div>
                ))}

                {/* Typing indicator */}
                {isLoading && <TypingIndicator />}

                <div ref={bottomRef} aria-hidden="true" />
            </main>

            {/* ── Input ── */}
            <footer className="chat-input-area">
                <form className="chat-input-form" onSubmit={handleSubmit}>
                    <textarea
                        ref={inputRef}
                        id="chat-input"
                        className="chat-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`שאל אותי כל דבר על המתנ"ס... (Enter לשליחה)`}
                        rows={1}
                        maxLength={500}
                        disabled={isLoading}
                        aria-label="הקלד שאלה"
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        id="chat-send-button"
                        className="chat-send-btn"
                        disabled={isLoading || !input.trim()}
                        aria-label="שלח הודעה"
                    >
                        <Send size={20} />
                    </button>
                </form>
                <p className="chat-hint">מוגן על ידי AI · מתני עונה רק על שאלות הקשורות למתנ&quot;ס</p>
            </footer>
        </div>
    );
}
