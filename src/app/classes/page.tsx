import Navbar from '@/components/layout/Navbar';
import { Search, Filter, ArrowLeftIcon } from 'lucide-react';

export default function ClassesPage() {
    const dummyClasses = [
        { title: 'רובוטיקה וקוד לילדים', category: 'טכנולוגיה', age: '8-12', time: 'שני 17:00 ל-18:30', instructor: 'דן כהן', bg: 'icon-blue' },
        { title: 'יוגה ומדיטציה בבוקר', category: 'גוף ונפש', age: '18+', time: 'רביעי 08:30 ל-09:30', instructor: 'יעל שטרן', bg: 'icon-green' },
        { title: 'אמנות ציור בפחם', category: 'אמנות ויצירה', age: '12-16', time: 'חמישי 16:00 ל-18:00', instructor: 'רון לוי', bg: 'icon-orange' },
        {
            title: 'ג'ודו למתחילים', category: 'ספורט', age: '6 - 10', time: 'ראשון ורביעי 16: 30', instructor: 'אלון בר', bg: 'icon - blue' },
    { title: 'סדנת כתיבה יוצרת', category: 'העשרה', age: '18+', time: 'שלישי 19:30 ל-21:00', instructor: 'מיכל אברהמי', bg: 'icon-orange' },
    { title: 'הכנה לכיתה איי', category: 'חינוך', age: '5-6', time: 'שני 16:00', instructor: 'שירה כץ', bg: 'icon-green' },
    ];

    return (
        <>
            <div className="container">
                <Navbar />

                <main style={{ padding: '3rem 0', minHeight: 'calc(100vh - 100px)' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h1 style={{ fontSize: '2.5rem' }}>חוגים ופעילויות 🎨</h1>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '300px' }}>
                                <Search size={18} color="var(--text-secondary)" />
                                <input type="text" placeholder="חיפוש חוגים..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }} />
                            </div>
                            <button className="btn btn-secondary btn-icon">
                                <Filter size={18} />
                            </button>
                        </div>
                    </header>

                    <div className="features-grid" style={{ padding: 0 }}>
                        {dummyClasses.map((item, idx) => (
                            <div key={idx} className="card feature-card animate-fade-up" style={{ animationDelay: `${0.1 * idx}s`, textAlign: 'right', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
                                    <span className={`hero-badge ${item.bg}`} style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem' }}>
                                        {item.category}
                                    </span>
                                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>גילי {item.age}</span>
                                </div>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span>🕒 {item.time}</span>
                                    <span>👤 מדריך: {item.instructor}</span>
                                </div>
                                <button className="btn btn-primary btn-md" style={{ width: '100%', marginTop: 'auto' }}>
                                    לפרטים והרשמה
                                </button>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </>
    );
}
