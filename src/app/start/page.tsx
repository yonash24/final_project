'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, HeartHandshake, MessageSquare, Sparkles, Users } from 'lucide-react';

import Navbar from '@/components/layout/Navbar';

type StartGoal = 'classes' | 'events' | 'help' | 'family';
type StartAudience = 'kids' | 'teens' | 'adults' | 'seniors' | 'family';
type StartNeed = 'today' | 'routine' | 'social' | 'easy';

const goalOptions: Array<{ id: StartGoal; title: string; text: string }> = [
    { id: 'classes', title: 'למצוא חוג קבוע', text: 'למי שמחפש מסגרת שבועית ברורה.' },
    { id: 'events', title: 'לראות מה קורה בקרוב', text: 'לאירועים, סדנאות ומפגשים חד-פעמיים.' },
    { id: 'help', title: 'לקבל הכוונה פשוטה', text: 'אם נוח יותר לשאול בשפה חופשית.' },
    { id: 'family', title: 'לסדר משהו לכל המשפחה', text: 'כשמחפשים פתרון לכמה בני בית יחד.' },
];

const audienceOptions: Array<{ id: StartAudience; title: string }> = [
    { id: 'kids', title: 'ילדים' },
    { id: 'teens', title: 'נוער' },
    { id: 'adults', title: 'מבוגרים' },
    { id: 'seniors', title: 'גיל שלישי' },
    { id: 'family', title: 'כל המשפחה' },
];

const needOptions: Array<{ id: StartNeed; title: string; text: string }> = [
    { id: 'today', title: 'משהו קרוב ובקרוב', text: 'אם רוצים למצוא פעילות ממש לשבוע הקרוב.' },
    { id: 'routine', title: 'מסגרת קבועה', text: 'אם חשוב יום קבוע ושגרה מסודרת.' },
    { id: 'social', title: 'להכיר אנשים ולהתחבר', text: 'אם מחפשים חוויה חברתית וקהילתית.' },
    { id: 'easy', title: 'משהו פשוט בלי להסתבך', text: 'אם חשוב להתחיל בקלות ועם מעט החלטות.' },
];

export default function StartPage() {
    const [goal, setGoal] = useState<StartGoal>('classes');
    const [audience, setAudience] = useState<StartAudience>('family');
    const [need, setNeed] = useState<StartNeed>('easy');

    const recommendation = useMemo(() => {
        if (goal === 'help') {
            return {
                title: 'כדאי להתחיל משיחה פשוטה',
                description: 'אפשר לכתוב במילים חופשיות מה אתם מחפשים, ואנחנו נעזור לצמצם אפשרויות בלי לחפש לבד.',
                href: '/chat',
                button: 'לדבר איתי פשוט',
                tips: [
                    'כתבו למשל: "אני מחפשת משהו רגוע לאמא שלי בבוקר".',
                    'אפשר לשאול גם על מחיר, יום פנוי או מיקום.',
                    'אם לא בטוחים במילים המדויקות, זה בסדר גמור.',
                ],
            };
        }

        if (goal === 'events' || need === 'today') {
            return {
                title: 'כדאי להתחיל מהאירועים הקרובים',
                description: 'שם תראו מהר מה קורה בימים הקרובים, כולל שעה, מקום וניווט במפות.',
                href: '/events',
                button: 'לאירועים הקרובים',
                tips: [
                    'חפשו אירועים לפי השבוע הקרוב או החודש הקרוב.',
                    'אפשר להוסיף ליומן ולפתוח ניווט ישירות מהמחשב או מהטלפון.',
                    'מתאים במיוחד כשרוצים משהו מיידי ולא מסגרת קבועה.',
                ],
            };
        }

        if (goal === 'family') {
            return {
                title: 'כדאי להתחיל מלוח החוגים',
                description: 'שם אפשר לראות מגוון פעילויות לפי גיל, תחום עניין וזמינות, ואז להמשיך לעזרה אישית אם צריך.',
                href: '/classes',
                button: 'לחוגים ופעילויות',
                tips: [
                    'התחילו מהגיל הרלוונטי ביותר בבית.',
                    'אם צריך כמה פתרונות יחד, אפשר לעבור אחר כך לעזרה המהירה.',
                    'שווה לשים לב לסימון של מקומות אחרונים.',
                ],
            };
        }

        return {
            title: 'כדאי להתחיל מלוח החוגים',
            description: 'זה המסלול הפשוט ביותר כשמחפשים פעילות קבועה לפי גיל, תחום עניין ומקומות פנויים.',
            href: '/classes',
            button: audience === 'seniors' ? 'לפעילויות לגיל שלישי' : 'לחוגים ופעילויות',
            tips: [
                audience === 'seniors' ? 'בחרו קודם את סינון גיל שלישי כדי לצמצם את הרשימה.' : 'התחילו מחיפוש פשוט לפי מילה אחת, כמו מוזיקה או ספורט.',
                need === 'social' ? 'חפשו פעילויות קבוצתיות ומפגשים קבועים.' : 'אם משהו נראה מתאים, פתחו את דף הפרטים לפני הרשמה.',
                'אפשר תמיד לעצור ולעבור לשיחה פשוטה אם הרשימה מרגישה עמוסה.',
            ],
        };
    }, [audience, goal, need]);

    return (
        <div className="container">
            <Navbar />

            <main className="start-page" id="main-content">
                <header className="start-hero glass-panel">
                    <div className="hero-badge">
                        <Sparkles size={16} />
                        לא צריך לדעת מאיפה להתחיל
                    </div>
                    <h1>נכוון אתכם צעד אחר צעד למה שמתאים לכם.</h1>
                    <p>
                        בוחרים שלושה דברים פשוטים, ומקבלים מסלול התחלה ברור: איפה לחפש, על מה ללחוץ ומה הכי נכון לבדוק קודם.
                    </p>
                </header>

                <section className="start-grid">
                    <article className="card start-card">
                        <div className="start-step">שלב 1</div>
                        <h2>מה הכי חשוב לכם עכשיו?</h2>
                        <div className="choice-grid">
                            {goalOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`choice-card ${goal === option.id ? 'is-selected' : ''}`}
                                    onClick={() => setGoal(option.id)}
                                >
                                    <strong>{option.title}</strong>
                                    <span>{option.text}</span>
                                </button>
                            ))}
                        </div>
                    </article>

                    <article className="card start-card">
                        <div className="start-step">שלב 2</div>
                        <h2>עבור מי אתם מחפשים?</h2>
                        <div className="pill-row">
                            {audienceOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`pill-choice ${audience === option.id ? 'is-selected' : ''}`}
                                    onClick={() => setAudience(option.id)}
                                >
                                    {option.title}
                                </button>
                            ))}
                        </div>

                        <div className="start-step" style={{ marginTop: '1.5rem' }}>שלב 3</div>
                        <h2>איזו התחלה תרגיש לכם נוחה?</h2>
                        <div className="choice-grid compact">
                            {needOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`choice-card ${need === option.id ? 'is-selected' : ''}`}
                                    onClick={() => setNeed(option.id)}
                                >
                                    <strong>{option.title}</strong>
                                    <span>{option.text}</span>
                                </button>
                            ))}
                        </div>
                    </article>
                </section>

                <section className="start-recommendation card">
                    <div>
                        <div className="hero-badge" style={{ marginBottom: '1rem' }}>
                            <HeartHandshake size={16} />
                            ההמלצה שלנו בשבילכם
                        </div>
                        <h2>{recommendation.title}</h2>
                        <p>{recommendation.description}</p>
                    </div>

                    <ul className="feature-list" style={{ marginBottom: '0.5rem' }}>
                        {recommendation.tips.map((tip) => (
                            <li key={tip}>{tip}</li>
                        ))}
                    </ul>

                    <div className="hero-actions">
                        <Link href={recommendation.href} className="btn btn-primary btn-lg">
                            {recommendation.button}
                            <ArrowLeft size={18} />
                        </Link>
                        <Link href="/chat" className="btn btn-secondary btn-lg">
                            <MessageSquare size={18} />
                            לשאול שאלה פשוטה
                        </Link>
                    </div>
                </section>

                <section className="start-shortcuts">
                    <article className="showcase-card">
                        <div className="feature-icon-wrapper icon-blue">
                            <Users size={26} />
                        </div>
                        <h3>מחפשים חוג קבוע?</h3>
                        <p>לוח החוגים מתאים במיוחד למי שרוצה שגרה מסודרת, מחיר ברור והרשמה פשוטה.</p>
                    </article>

                    <article className="showcase-card">
                        <div className="feature-icon-wrapper icon-orange">
                            <CalendarDays size={26} />
                        </div>
                        <h3>מחפשים משהו לשבוע הקרוב?</h3>
                        <p>לוח האירועים עוזר למצוא מהר פעילויות חד-פעמיות, כולל שעה, מקום וניווט.</p>
                    </article>

                    <article className="showcase-card">
                        <div className="feature-icon-wrapper icon-green">
                            <MessageSquare size={26} />
                        </div>
                        <h3>רוצים שמישהו יסביר בפשטות?</h3>
                        <p>העזרה המהירה נבנתה במיוחד למי שמעדיפים לכתוב בשפה טבעית ולא להתמודד עם מסננים.</p>
                    </article>
                </section>
            </main>
        </div>
    );
}
