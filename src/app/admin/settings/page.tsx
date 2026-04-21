import AdminNavbar from '@/components/admin/AdminNavbar';
import { Shield, Bell, Palette, Globe, Save } from 'lucide-react';

export default function AdminSettingsPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>הגדרות מערכת ⚙️</h1>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    {/* Sidebar Settings Categories */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button className="btn btn-ghost btn-md" style={{ justifyContent: 'flex-start', color: 'var(--accent-primary)', backgroundColor: 'var(--bg-secondary)' }}><Shield size={18} /> אבטחה והרשאות</button>
                        <button className="btn btn-ghost btn-md" style={{ justifyContent: 'flex-start' }}><Bell size={18} /> התראות והודעות</button>
                        <button className="btn btn-ghost btn-md" style={{ justifyContent: 'flex-start' }}><Palette size={18} /> עיצוב ומיתוג</button>
                        <button className="btn btn-ghost btn-md" style={{ justifyContent: 'flex-start' }}><Globe size={18} /> הגדרות אתר</button>
                    </div>

                    {/* Settings content */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>פרופיל מנהל</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם מלא</label>
                                    <input className="input-field" defaultValue="מנהל מתנ״ס ראשי" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תפקיד</label>
                                    <input className="input-field" defaultValue="מנהל תחום פנאי" />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>אימייל להתראות</label>
                                <input className="input-field" defaultValue="admin@matnas.com" />
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>שינוי סיסמה</h2>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>סיסמה נוכחית</label>
                                <input className="input-field" type="password" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>סיסמה חדשה</label>
                                    <input className="input-field" type="password" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>אימות סיסמה חדשה</label>
                                    <input className="input-field" type="password" />
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-md">
                                    <Save size={18} /> שמור שינויים
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
