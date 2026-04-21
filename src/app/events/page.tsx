import Navbar from '@/components/layout/Navbar';
import { Calendar, MapPin, Share2 } from 'lucide-react';

export default function EventsPage() {
    const dummyEvents = [
        { title: 'הפנינג פתיחת הקיץ ☀️', date: '21 ביוני, 2026', time: '16:00 - 20:00', location: 'רחבת המתנ"ס המרכזית', desc: 'הפנינג חגיגי לכל המשפחה עם דוכנים, הפעלות רטובות, מוזיקה חיה ומתקנים מתנפחים.' },
        { title: 'הרצאה: תזונה נכונה וחכמה', date: '05 ביולי, 2026', time: '19:30 - 21:00', location: 'אולם כנסים', desc: 'פרופ\' רחל מנשה מגיעה להרצות על תזונה נבונה, מנפצת מיתוסים ונותנת כלים מעשיים.' },
        { title: 'שוק עתיקות ויד שנייה', date: '12 ביולי, 2026', time: '09:00 - 14:00', location: 'אולם הספורט', desc: 'יריד הקהילה לאספנות ומכירה של חפצי יד שנייה, בגדים, וספרים מתוך הקהילה ולמענה.' }
    ];

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>לוח אירועים קהילתי 📅</h1>
                        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                            הישארו מעודכנים בכל הפעילויות החינמיות והמסובסדות שהמתנ"ס מציע.
                        </p>
                    </header>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                        {dummyEvents.map((evt, idx) => (
                            <div key={idx} className="card animate-fade-up" style={{ animationDelay: `${0.1 * idx}s`, display: 'flex', flexDirection: 'row', gap: '2rem', padding: '1.5rem' }}>

                                {/* Date Side */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '120px', borderLeft: '2px dashed var(--border-color)', paddingLeft: '1.5rem' }}>
                                    <Calendar size={32} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
                                    <div style={{ fontWeight: 'bold', fontSize: '1.125rem', textAlign: 'center' }}>{evt.date}</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>{evt.time}</div>
                                </div>

                                {/* Content Side */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{evt.title}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                        <MapPin size={16} /> <span>{evt.location}</span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{evt.desc}</p>

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                                        <button className="btn btn-primary btn-sm">שריין מקום</button>
                                        <button className="btn btn-outline btn-sm"><Share2 size={16} style={{ marginLeft: '0.5rem' }} /> שתף לחברים</button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </>
    );
}
