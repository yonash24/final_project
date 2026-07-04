"use client";
import Image from 'next/image';
import AdminNavbar from '@/components/admin/AdminNavbar';
import { Palette, Sparkles, Send, Copy, CheckCircle2, RefreshCw, ChevronRight, Download, Info, Phone, MapPin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

type DesignOption = {
    id: string;
    name: string;
    description: string;
    icon: string;
    palette: {
        primary: string;
        secondary: string;
        text: string;
        bg: string;
    };
};

type FlyerData = {
    title: string;
    subtitle: string;
    body: string;
    highlights: string[];
    contact: string;
    cta: string;
    imageUrl: string;
};

type StudioActivity = {
    id: string;
    title_he: string;
    description_he?: string | null;
    instructor_name?: string | null;
    price?: number | null;
    days_of_week?: string | null;
    target_age_group?: string | null;
};

export default function StudioPage() {
    const [step, setStep] = useState<'input' | 'designs' | 'result'>('input');
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState<'post' | 'flyer'>('post');
    const [isLoading, setIsLoading] = useState(false);
    const [designs, setDesigns] = useState<DesignOption[]>([]);
    const [selectedDesign, setSelectedDesign] = useState<DesignOption | null>(null);
    const [flyerData, setFlyerData] = useState<FlyerData | null>(null);
    const [resultText, setResultText] = useState('');
    const [copied, setCopied] = useState(false);
    const [activities, setActivities] = useState<StudioActivity[]>([]);
    const [selectedActivityId, setSelectedActivityId] = useState('');
    
    const flyerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const res = await fetch('/api/activities');
                const data = await res.json();
                if (Array.isArray(data)) setActivities(data as StudioActivity[]);
            } catch (e) {
                console.error('Failed to fetch activities', e);
            }
        };
        void fetchActivities();
    }, []);

    const handleActivityChange = (id: string) => {
        setSelectedActivityId(id);
        const act = activities.find((a) => a.id === id);
        if (act) {
            const context = `חוג: ${act.title_he}
${act.description_he ? `תיאור: ${act.description_he}` : ''}
${act.instructor_name ? `מדריך: ${act.instructor_name}` : ''}
${act.price ? `מחיר: ${act.price}₪` : ''}
${act.days_of_week ? `ימים: ${act.days_of_week}` : ''}
${act.target_age_group ? `קהל יעד: ${act.target_age_group}` : ''}`;
            setPrompt(context);
        }
    };

    const handleInitialSubmit = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        
        if (type === 'flyer') {
            try {
                const res = await fetch('/api/studio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, type, action: 'get_designs' }),
                });
                const data = await res.json();
                if (data.designs) {
                    setDesigns(data.designs);
                    setStep('designs');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        } else {
            // Handle social post (legacy mode)
            try {
                const res = await fetch('/api/studio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, type }),
                });
                const data = await res.json();
                if (data.marketingText) {
                    setResultText(data.marketingText);
                    setFlyerData({
                        title: '',
                        subtitle: '',
                        body: '',
                        highlights: [],
                        contact: '',
                        cta: '',
                        imageUrl: data.imageUrl,
                    });
                    setStep('result');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleGenerateFlyer = async (design: DesignOption) => {
        setSelectedDesign(design);
        setIsLoading(true);
        try {
            const res = await fetch('/api/studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'flyer', action: 'generate', design }),
            });
            const data = await res.json();
            setFlyerData(data);
            setStep('result');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!flyerRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(flyerRef.current, {
                useCORS: true,
                scale: 2,
            });
            const link = document.createElement('a');
            link.download = `flyer-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Download failed', e);
        }
    };

    const handleCopy = () => {
        const text = flyerData ? `${flyerData.title}\n${flyerData.subtitle}\n\n${flyerData.body}\n\n${flyerData.highlights.join('\n')}\n\n${flyerData.contact}` : resultText;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0', maxWidth: '1000px' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <Palette size={48} color="var(--accent-primary)" />
                        סטודיו שיווק AI
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
                        מלווה אתכם מרעיון לפלייר מושלם תוך דקות
                    </p>
                </div>

                {/* Progress Steps */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem' }}>
                    {[
                        { id: 'input', label: 'פרטי הפעילות', icon: <Info size={16} /> },
                        { id: 'designs', label: 'בחירת עיצוב', icon: <Palette size={16} /> },
                        { id: 'result', label: 'הפלייר שלך', icon: <CheckCircle2 size={16} /> }
                    ].map((s, idx) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step === s.id ? 1 : 0.5, fontWeight: step === s.id ? 700 : 400, color: step === s.id ? 'var(--accent-primary)' : 'inherit' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === s.id ? 'var(--accent-primary)' : '#e2e8f0', color: step === s.id ? 'white' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                                {idx + 1}
                            </div>
                            <span>{s.label}</span>
                            {idx < 2 && <ChevronRight size={16} style={{ margin: '0 0.5rem', opacity: 0.3 }} />}
                        </div>
                    ))}
                </div>

                {step === 'input' && (
                    <div className="card animate-fade-up" style={{ padding: '2.5rem', maxWidth: '700px', margin: '0 auto' }}>
                        <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Sparkles size={24} color="var(--accent-secondary)" />
                            מה נפרסם היום?
                        </h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>בחר חוג מהמאגר (אופציונלי):</label>
                            <select
                                className="input-field"
                                value={selectedActivityId}
                                onChange={(e) => handleActivityChange(e.target.value)}
                            >
                                <option value="">--- בחר חוג כדי למלא פרטים אוטומטית ---</option>
                                {activities.map((act) => (
                                    <option key={act.id} value={act.id}>{act.title_he}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <button className={`btn ${type === 'post' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('post')} style={{ flex: 1 }}>
                                <Send size={18} /> פוסט לרשתות
                            </button>
                            <button className={`btn ${type === 'flyer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('flyer')} style={{ flex: 1 }}>
                                <Palette size={18} /> פלייר מעוצב
                            </button>
                        </div>

                        <textarea
                            className="input-field"
                            style={{ height: '180px', padding: '1rem', marginBottom: '2rem', resize: 'none' }}
                            placeholder='למשל: "סדנת נגרות לילדים ביום שישי בבוקר, נבנה יחד בתי ציפורים ונהנה מארוחת בוקר קלה. מתאים לגילאי 8-12"'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleInitialSubmit} disabled={isLoading || !prompt.trim()}>
                            {isLoading ? <RefreshCw className="animate-spin" /> : <ChevronRight />}
                            {isLoading ? 'חושב על רעיונות...' : type === 'flyer' ? 'בחר עיצובים' : 'ייצר פוסט'}
                        </button>
                    </div>
                )}

                {step === 'designs' && (
                    <div className="animate-fade-up">
                        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>בחר את הסגנון המועדף עליך</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                            {designs.map((design) => (
                                <div 
                                    key={design.id} 
                                    className="card" 
                                    style={{ 
                                        padding: '1.5rem', 
                                        cursor: 'pointer', 
                                        transition: 'all 0.3s ease',
                                        border: '2px solid transparent',
                                        background: design.palette.bg
                                    }}
                                    onClick={() => handleGenerateFlyer(design)}
                                >
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: design.palette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                                        <Palette size={24} />
                                    </div>
                                    <h4 style={{ color: design.palette.text, marginBottom: '0.5rem' }}>{design.name}</h4>
                                    <p style={{ fontSize: '0.9rem', color: design.palette.text, opacity: 0.8, marginBottom: '1rem' }}>{design.description}</p>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {[design.palette.primary, design.palette.secondary].map(c => (
                                            <div key={c} style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button className="btn btn-ghost" onClick={() => setStep('input')}>חזור לשלב הקודם</button>
                        </div>
                    </div>
                )}

                {step === 'result' && (
                    <div className="animate-fade-up">
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <button className="btn btn-primary" onClick={handleDownload}>
                                <Download size={18} /> הורד כפלייר (PNG)
                            </button>
                            <button className="btn btn-secondary" onClick={handleCopy}>
                                {copied ? <CheckCircle2 color="#16a34a" /> : <Copy size={18} />}
                                {copied ? 'הועתק!' : 'העתק טקסט'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setStep('input')}>צור חדש</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {type === 'flyer' && flyerData ? (
                                <div 
                                    ref={flyerRef}
                                    style={{ 
                                        width: '600px', 
                                        minHeight: '840px', 
                                        backgroundColor: selectedDesign?.palette.bg || 'white',
                                        color: selectedDesign?.palette.text || '#000',
                                        padding: '3rem',
                                        borderRadius: '4px',
                                        boxShadow: 'var(--shadow-lg)',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        fontFamily: 'Heebo, sans-serif',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Decorative header */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '10px', backgroundColor: selectedDesign?.palette.primary }} />
                                    
                                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '0.5rem', color: selectedDesign?.palette.primary, lineHeight: 1.1 }}>{flyerData.title}</h1>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, opacity: 0.9 }}>{flyerData.subtitle}</h3>
                                    </div>

                                    <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '1.2rem', lineHeight: 1.6, marginBottom: '2rem' }}>{flyerData.body}</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {flyerData.highlights.map((h, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedDesign?.palette.secondary }} />
                                                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{h}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <Image
                                                src={flyerData.imageUrl}
                                                alt="Activity"
                                                width={420}
                                                height={420}
                                                unoptimized
                                                style={{ width: '100%', height: 'auto', borderRadius: '12px', boxShadow: 'var(--shadow-md)', border: '4px solid white' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                                        <div style={{ display: 'inline-block', backgroundColor: selectedDesign?.palette.primary, color: 'white', padding: '1rem 3rem', borderRadius: '50px', fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', boxShadow: 'var(--shadow-md)' }}>
                                            {flyerData.cta}
                                        </div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Phone size={16} /> {flyerData.contact}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <MapPin size={16} /> המרכז הקהילתי הדיגיטלי
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer logo/branding */}
                                    <div style={{ position: 'absolute', bottom: '1.5rem', left: '3rem', fontSize: '0.8rem', opacity: 0.5, fontWeight: 700 }}>
                                        CREATED BY SMART COMMUNITY STUDIO
                                    </div>
                                </div>
                            ) : (
                                <div className="card" style={{ padding: '2rem', maxWidth: '600px', width: '100%' }}>
                                     {flyerData?.imageUrl && (
                                        <Image src={flyerData.imageUrl} alt="Post" width={560} height={560} unoptimized style={{ width: '100%', height: 'auto', borderRadius: '12px', marginBottom: '1.5rem' }} />
                                    )}
                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem', lineHeight: 1.8 }}>{resultText}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {isLoading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                        <Sparkles size={30} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent-secondary)' }} />
                    </div>
                    <h3 style={{ marginTop: '1.5rem' }}>ה-AI שלנו מעצב עבורך...</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>זה לוקח כמה שניות, אבל זה שווה את זה!</p>
                    <style jsx>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                    `}</style>
                </div>
            )}
        </div>
    );
}
