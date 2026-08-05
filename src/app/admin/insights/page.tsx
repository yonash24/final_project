"use client";

import AdminNavbar from '@/components/admin/AdminNavbar';
import { ChartBar as BarChart3, TriangleAlert as AlertTriangle, TrendingUp, Search, MessageCircle, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface IntentItem { intent: string; count: number }
interface QueryItem { query: string; intent: string; hitCount: number; hadResults?: boolean; lastSeen: string }

interface InsightsData {
    totalQueries: number;
    totalUniqueQueries: number;
    answeredRate: string;
    intentDistribution: IntentItem[];
    topUnanswered: QueryItem[];
    topPopular: QueryItem[];
    recentCount: number;
}

const INTENT_LABELS: Record<string, string> = {
    search_activities: '🔍 חיפוש חוגים',
    search_events: '📅 חיפוש אירועים',
    activity_details: '📋 פרטי חוג',
    price_inquiry: '💰 שאלת מחיר',
    schedule_inquiry: '🕐 לוח זמנים',
    age_inquiry: '👶 שאלת גיל',
    availability_inquiry: '✅ זמינות',
    general_info: 'ℹ️ מידע כללי',
    recommendation: '🎯 המלצה',
    greeting: '👋 ברכה',
    off_topic: '❌ לא קשור',
    unknown: '❓ לא מזוהה',
};

export default function InsightsPage() {
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'unanswered' | 'popular'>('unanswered');

    useEffect(() => {
        fetch('/api/admin/insights')
            .then((res) => res.json())
            .then((d) => setData(d))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="admin-root">
                <AdminNavbar />
                <main className="admin-container" id="main-content" style={{ textAlign: 'center' }}>
                    <p>טוען נתונים...</p>
                </main>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="admin-root">
                <AdminNavbar />
                <main className="admin-container" id="main-content">
                    <div className="card admin-section-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <AlertTriangle size={40} style={{ color: 'var(--warning-500)', marginBottom: '1rem' }} />
                        <h3>טבלת תובנות עדיין לא קיימת</h3>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            יש להריץ את המיגרציה <code>0007_ai_upgrade.sql</code> כדי ליצור את הטבלה.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    const maxIntentCount = data.intentDistribution.length > 0
        ? Math.max(...data.intentDistribution.map((i) => i.count))
        : 1;

    return (
        <div className="admin-root">
            <AdminNavbar />
            <main className="admin-container" id="main-content">
                <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: '0.5rem' }}>תובנות AI 🧠</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    מה התושבים שואלים? איפה הצ&apos;אט לא עזר? מה הנושאים הפופולריים?
                </p>

                {/* Stats Cards */}
                <div className="admin-stats-grid">
                    <StatCard icon={<MessageCircle color="var(--primary-600)" />} label="סה&quot;כ שאלות" value={String(data.totalQueries)} bg="var(--primary-50)" />
                    <StatCard icon={<Search color="var(--primary-600)" />} label="שאלות ייחודיות" value={String(data.totalUniqueQueries)} bg="var(--primary-50)" />
                    <StatCard icon={<Zap color="var(--success-600)" />} label="אחוז מענה" value={`${data.answeredRate}%`} bg="var(--success-50)" />
                    <StatCard icon={<TrendingUp color="var(--warning-500)" />} label="שאלות השבוע" value={String(data.recentCount)} bg="var(--warning-100)" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Intent Distribution */}
                    <div className="card admin-section-card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart3 size={20} /> התפלגות כוונות
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {data.intentDistribution.map((item) => (
                                <div key={item.intent}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        <span>{INTENT_LABELS[item.intent] || item.intent}</span>
                                        <span style={{ fontWeight: 700 }}>{item.count}</span>
                                    </div>
                                    <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--neutral-200)', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(item.count / maxIntentCount) * 100}%`,
                                            height: '100%',
                                            backgroundColor: 'var(--primary-600)',
                                            borderRadius: '999px',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                            {data.intentDistribution.length === 0 && (
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>עדיין אין נתונים</p>
                            )}
                        </div>
                    </div>

                    {/* Queries Table */}
                    <div className="card admin-section-card">
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <button
                                onClick={() => setActiveTab('unanswered')}
                                className={`btn btn-sm ${activeTab === 'unanswered' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <AlertTriangle size={14} /> ללא מענה ({data.topUnanswered.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('popular')}
                                className={`btn btn-sm ${activeTab === 'popular' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <TrendingUp size={14} /> פופולריים ({data.topPopular.length})
                            </button>
                        </div>

                        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>
                                        <th style={{ padding: '0.5rem' }}>שאילתה</th>
                                        <th style={{ padding: '0.5rem' }}>כוונה</th>
                                        <th style={{ padding: '0.5rem' }}>פעמים</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(activeTab === 'unanswered' ? data.topUnanswered : data.topPopular).map((q, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {q.query}
                                            </td>
                                            <td style={{ padding: '0.5rem', fontSize: '0.78rem' }}>
                                                {INTENT_LABELS[q.intent] || q.intent}
                                            </td>
                                            <td style={{ padding: '0.5rem', fontWeight: 700 }}>{q.hitCount}</td>
                                        </tr>
                                    ))}
                                    {(activeTab === 'unanswered' ? data.topUnanswered : data.topPopular).length === 0 && (
                                        <tr>
                                            <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                עדיין אין נתונים
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
    return (
        <div className="card admin-section-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {icon}
            </div>
            <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{value}</div>
            </div>
        </div>
    );
}
