import Navbar from '@/components/layout/Navbar';
import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react';

export default function FeedPage() {
    const dummyPosts = [
        {
            author: 'הנהלת המתנ"ס',
            role: 'רשמי',
            time: 'לפני שעתיים',
            content: 'גאים לפתוח את שיעורי העזר החדשים במתמטיקה לתלמידי התיכון לקראת תקופת המבחנים. הפעילות בסבסוד מלא – נותרו מקומות בודדים!',
            likes: 24,
            comments: 3
        },
        {
            author: 'צוות הנוער - שבט צופים',
            role: 'קהילה',
            time: 'אתמול ב-15:40',
            content: 'הפנינג איסוף תרומות למשפחות נזקקות לקראת החגים עבר בהצלחה אדירה! תודה לכל התושבים שנרתמו ולכל בני הנוער מארגון הצופים שעזרו במיון והאריזה. 💚',
            likes: 89,
            comments: 12
        },
        {
            author: 'דינה אברהם',
            role: 'תושבת',
            time: '20 ביוני, 10:00',
            content: 'האם מישהו יודע אם יש עדיין מקום בחוג פילאטיס של יום שני בבוקר? ניסיתי להתקשר ולא ענו לי.',
            likes: 2,
            comments: 1
        }
    ];

    return (
        <div style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '3rem' }}>
            <div className="container">
                <Navbar />

                <main style={{ padding: '2rem 0', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Create Post Input */}
                        <div className="card animate-fade-up" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0' }}></div>
                                <input type="text" className="input-field" placeholder="מה חדש בקהילה?" style={{ border: 'none', backgroundColor: '#f1f5f9' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button className="btn btn-primary btn-sm">פרסם</button>
                            </div>
                        </div>

                        {/* Feed Posts */}
                        {dummyPosts.map((post, idx) => (
                            <div key={idx} className="card animate-fade-up" style={{ animationDelay: `${0.1 * idx + 0.1}s` }}>
                                <div className="card-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {post.author.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{post.author}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                <span style={{ color: post.role === 'רשמי' ? 'var(--accent-primary)' : 'inherit', fontWeight: post.role === 'רשמי' ? 'bold' : 'normal' }}>{post.role}</span> • {post.time}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-icon"><MoreHorizontal size={20} /></button>
                                </div>

                                <div className="card-content" style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
                                    {post.content}
                                </div>

                                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '2rem' }}>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: 0, gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <Heart size={20} /> {post.likes}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: 0, gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <MessageCircle size={20} /> {post.comments} תגובות
                                    </button>
                                </div>
                            </div>
                        ))}

                    </div>
                </main>
            </div>
        </div>
    );
}
