import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarDays,
  LayoutDashboard,
  MessageSquare,
  Palette,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';

import Navbar from '@/components/layout/Navbar';

const residentBenefits = [
  'חיפוש חוגים לפי גיל, יום, מחיר וזמינות',
  'צ׳אט שמחזיר רק את המידע שהתבקש',
  'גישה מהירה לאירועים, הרשמה ופרטי קשר',
];

const managerBenefits = [
  'ניהול חוגים ואירועים מאזור מנהלים מאובטח',
  'ייבוא אקסל עם Preview, מיפוי עמודות ואישור',
  'פרסום תוכן שיווקי ועדכונים קהילתיים ממקום אחד',
];

const workflowSteps = [
  {
    title: 'מזינים נתונים',
    text: 'מעלים חוגים ואירועים ידנית או מקובץ אקסל מסודר.',
    icon: Upload,
  },
  {
    title: 'המערכת בודקת',
    text: 'מזהה כפילויות, מאמתת שדות ומכינה את המידע להצגה.',
    icon: ShieldCheck,
  },
  {
    title: 'התושבים מקבלים תשובה',
    text: 'הצ׳אט והעמודים הציבוריים מחזירים רק את מה שרלוונטי לבקשה.',
    icon: MessageSquare,
  },
];

const faqs = [
  {
    q: 'מה היתרון של הצ׳אט על פני חיפוש רגיל?',
    a: 'הצ׳אט מבין שאלות טבעיות כמו גיל, יום, מחיר או שם חוג, ומחזיר תשובה ממוקדת במקום לחייב את המשתמש לעבור בין מסכים.',
  },
  {
    q: 'איך מייבאים הרבה חוגים בבת אחת?',
    a: 'באזור המנהלים מעלים קובץ `xlsx` או `csv`, ממפים את העמודות, רואים preview, ורק אחר כך מאשרים כתיבה למערכת.',
  },
  {
    q: 'האם אפשר להשתמש במערכת גם לאירועים?',
    a: 'כן. יש דפי אירועים לציבור, ניהול אירועים בצד האדמין, וגם הצ׳אט יודע להחזיר אירועים בלבד כשזה מה שהתבקש.',
  },
];

export default function Home() {
  return (
    <>
      <div className="container">
        <Navbar />

        <header className="hero">
          <div className="hero-content animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="hero-badge">
              <Sparkles size={16} className="mr-2" />
              פלטפורמה חכמה למרכזים קהילתיים
            </div>
            <h1 className="hero-title">
              ניהול קהילה <span>מדויק</span>,
              <br />
              שירות תושבים <span>מהיר</span>.
            </h1>
            <p className="hero-subtitle">
              מערכת אחת שמחברת בין הנהלת המתנ&quot;ס, התוכן הקהילתי והצ׳אט. הנתונים נשמרים במקום אחד, השאלות מקבלות תשובות ממוקדות,
              והצוות חוסך זמן יקר בניהול ובעדכונים.
            </p>

            <div className="hero-actions">
              <Link href="/chat" className="btn btn-primary btn-lg">
                <MessageSquare size={20} />
                נסה את הצ׳אט
              </Link>
              <Link href="/admin/login" className="btn btn-secondary btn-lg">
                <LayoutDashboard size={20} />
                כניסת מנהלים
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat-card">
                <strong>צ׳אט ממוקד</strong>
                <span>תשובות מדויקות בלי הרחבות מיותרות</span>
              </div>
              <div className="hero-stat-card">
                <strong>ייבוא בטוח</strong>
                <span>Preview ואישור לפני כתיבה למערכת</span>
              </div>
              <div className="hero-stat-card">
                <strong>ניהול מאובטח</strong>
                <span>גישה והרשאות דרך Supabase Auth</span>
              </div>
            </div>
          </div>

          <div className="hero-image-wrapper animate-fade-up animate-float" style={{ animationDelay: '0.4s' }}>
            <Image
              src="/images/hero.png"
              alt="Community center dashboard illustration"
              width={900}
              height={680}
              priority
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </header>
      </div>

      <section className="features-section">
        <div className="features-header animate-fade-up">
          <h2 className="features-title">איך המערכת עובדת</h2>
          <p>זרימה ברורה אחת שמחברת מידע, שירות לתושבים וכלי ניהול.</p>
        </div>

        <div className="workflow-grid">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="feature-card animate-fade-up" style={{ animationDelay: `${0.12 * (index + 1)}s` }}>
                <div className="feature-icon-wrapper icon-blue">
                  <Icon size={30} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dual-section">
        <div className="container dual-grid">
          <article className="glass-panel info-panel">
            <div className="hero-badge" style={{ marginBottom: '1rem' }}>
              <Users size={16} />
              לתושבים
            </div>
            <h2>חוויה פשוטה גם כשיש הרבה פעילויות</h2>
            <ul className="feature-list">
              {residentBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/classes" className="btn btn-secondary btn-md">לצפייה בחוגים</Link>
          </article>

          <article className="glass-panel info-panel">
            <div className="hero-badge" style={{ marginBottom: '1rem', background: '#fff7ed', color: '#c2410c' }}>
              <LayoutDashboard size={16} />
              למנהלים
            </div>
            <h2>תפעול מהיר בלי כפילויות ובלי בלגן</h2>
            <ul className="feature-list">
              {managerBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/admin/classes/import" className="btn btn-primary btn-md">למסך הייבוא</Link>
          </article>
        </div>
      </section>

      <section className="showcase-section">
        <div className="container">
          <div className="features-header animate-fade-up">
            <h2 className="features-title">יכולות מרכזיות</h2>
            <p>מה שהמערכת כבר יודעת לעשות בפועל.</p>
          </div>

          <div className="showcase-grid">
            <div className="showcase-card">
              <div className="feature-icon-wrapper icon-blue"><MessageSquare size={28} /></div>
              <h3>צ׳אט לתושבים</h3>
              <p>חיפוש ממוקד של חוגים, מחירים, אירועים ופרטי פעילות.</p>
            </div>
            <div className="showcase-card">
              <div className="feature-icon-wrapper icon-orange"><Upload size={28} /></div>
              <h3>ייבוא חוגים מאקסל</h3>
              <p>העלאה, מיפוי, preview, זיהוי כפילויות ואישור לפני עדכון המערכת.</p>
            </div>
            <div className="showcase-card">
              <div className="feature-icon-wrapper icon-green"><CalendarDays size={28} /></div>
              <h3>ניהול אירועים</h3>
              <p>שמירה, עדכון ופרסום אירועים קהילתיים מתוך אזור הניהול.</p>
            </div>
            <div className="showcase-card">
              <div className="feature-icon-wrapper icon-blue"><Palette size={28} /></div>
              <h3>סטודיו שיווקי</h3>
              <p>יצירת פוסטים ופליירים מתוך נתוני החוגים הקיימים.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="container">
          <div className="features-header animate-fade-up">
            <h2 className="features-title">שאלות נפוצות</h2>
            <p>תשובות קצרות על השימוש היומיומי במערכת.</p>
          </div>

          <div className="faq-grid">
            {faqs.map((faq) => (
              <article key={faq.q} className="faq-card">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-panel">
          <div>
            <h2>רוצה לראות את זה בפעולה?</h2>
            <p>אפשר להתחיל בצ׳אט, לבדוק חוגים ואירועים, או להיכנס לאזור הניהול ולהעלות נתונים.</p>
          </div>
          <div className="hero-actions">
            <Link href="/chat" className="btn btn-primary btn-lg">לצ׳אט</Link>
            <Link href="/admin/login" className="btn btn-secondary btn-lg">לניהול</Link>
          </div>
        </div>
      </section>
    </>
  );
}
