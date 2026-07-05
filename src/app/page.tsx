import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  HeartHandshake,
  Info,
  MessageSquare,
  MapPin,
  Search,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';

import Navbar from '@/components/layout/Navbar';

const familyBenefits = [
  'איתור חוגים לפי גיל, יום, תחום עניין ומחיר',
  'צפייה באירועים קרובים, מועדים ומיקומים בלי להסתבך',
  'גישה מהירה לעדכונים, הודעות קהילה ופרטי הרשמה',
];

const supportBenefits = [
  'עזרה מהירה בשפה פשוטה למי שלא בטוח איפה למצוא כל דבר',
  'הכוונה לפעילויות מתאימות לילדים, נוער, מבוגרים וגיל שלישי',
  'מידע ברור על שעות, עלויות, מדריכים ודרכי הגעה',
];

const quickStartCards = [
  {
    title: 'לא בטוחים מאיפה מתחילים',
    text: 'מסלול קצר ופשוט שמכוון אתכם צעד אחר צעד לפי מי אתם מחפשים ומה נוח לכם.',
    icon: Sparkles,
  },
  {
    title: 'מוצאים פעילות מתאימה',
    text: 'מחפשים חוגים ופעילויות לפי גיל, תחום עניין, ימים פנויים ומקומות זמינים.',
    icon: Search,
  },
  {
    title: 'מתעדכנים במה שקורה',
    text: 'רואים אירועים קרובים, מועדים מיוחדים וחדשות קהילתיות במקום אחד מסודר.',
    icon: CalendarDays,
  },
  {
    title: 'מקבלים עזרה בדרך',
    text: 'אפשר לבקש הכוונה בשפה חופשית ולקבל תשובה פשוטה וברורה בלי לחפש לבד.',
    icon: MessageSquare,
  },
];

const communityHighlights = [
  {
    title: 'חוגים לכל שלב בחיים',
    text: 'אומנות, ספורט, העשרה ופעילויות פנאי לילדים, נוער, מבוגרים וגיל שלישי.',
    icon: Users,
    tone: 'icon-blue',
  },
  {
    title: 'אירועים ומפגשים קהילתיים',
    text: 'הרצאות, מופעים, סדנאות, ימי שיא ומפגשים שכונתיים שמתאימים לכל המשפחה.',
    icon: Ticket,
    tone: 'icon-orange',
  },
  {
    title: 'עדכונים שוטפים',
    text: 'פיד קהילתי עם הודעות, שינויים חשובים, הזמנות לאירועים ודברים שטוב לדעת מראש.',
    icon: HeartHandshake,
    tone: 'icon-green',
  },
  {
    title: 'מידע שימושי לפני שמגיעים',
    text: 'כתובות, שעות, מחירים, מדריכים ופרטים חשובים שמופיעים בצורה ברורה ונגישה.',
    icon: MapPin,
    tone: 'icon-blue',
  },
];

const faqs = [
  {
    q: 'איפה הכי כדאי להתחיל אם אני חדש/ה כאן?',
    a: 'מומלץ להתחיל מרשימת החוגים או לוח האירועים. אם לא בטוחים מה מתאים, אפשר להשתמש בעזרה המהירה ולקבל הכוונה לפי גיל, תחום עניין או יום פנוי.',
  },
  {
    q: 'האם אפשר לראות מראש אם נשארו מקומות?',
    a: 'כן. בדפי החוגים והאירועים אפשר לראות זמינות, מקומות אחרונים או אם הפעילות כבר מלאה.',
  },
  {
    q: 'אפשר למצוא גם מידע על מיקום, מחיר ושעות?',
    a: 'כן. בכל פעילות מוצגים פרטים חשובים כמו גיל מתאים, שעות, עלות, מיקום ומי המדריך או המדריכה.',
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
              הבית הקהילתי שלכם, גם אונליין
            </div>
            <h1 className="hero-title">
              כל מה שקורה במתנ&quot;ס
              <br />
              במקום אחד <span>ברור ונעים</span>.
            </h1>
            <p className="hero-subtitle">
              כאן אפשר למצוא חוגים, אירועים, עדכוני קהילה ועזרה מהירה בלי להסתבך. האתר בנוי כך שגם מי שלא מרגיש טכנולוגי יוכל להבין
              מיד איפה נרשמים, מה קורה השבוע ואילו פעילויות מתאימות למשפחה שלו.
            </p>

            <div className="hero-actions">
              <Link href="/start" className="btn btn-primary btn-lg">
                <Sparkles size={20} />
                מאיפה הכי כדאי להתחיל?
              </Link>
              <Link href="/classes" className="btn btn-primary btn-lg">
                <Users size={20} />
                לחוגים ופעילויות
              </Link>
              <Link href="/chat" className="btn btn-secondary btn-lg">
                <MessageSquare size={20} />
                דברו איתי פשוט
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat-card">
                <strong>חוגים לכל גיל</strong>
                <span>ילדים, נוער, מבוגרים וגיל שלישי</span>
              </div>
              <div className="hero-stat-card">
                <strong>עדכונים קהילתיים</strong>
                <span>אירועים, הודעות ושינויים חשובים</span>
              </div>
              <div className="hero-stat-card">
                <strong>עזרה פשוטה</strong>
                <span>הכוונה מהירה גם בלי ידע טכני</span>
              </div>
            </div>
          </div>

          <div className="hero-image-wrapper animate-fade-up animate-float" style={{ animationDelay: '0.4s' }}>
            <Image
              src="/images/hero.png"
              alt="איור של פעילות קהילתית במתנס"
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
          <h2 className="features-title">מה אפשר לעשות כאן</h2>
          <p>המסלולים המרכזיים שמעניינים תושבים, משפחות וקהילה.</p>
        </div>

        <div className="workflow-grid">
          {quickStartCards.map((step, index) => {
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
              למשפחות ולתושבים
            </div>
            <h2>מוצאים בקלות את מה שמתאים לכם</h2>
            <ul className="feature-list">
              {familyBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/classes" className="btn btn-secondary btn-md">לרשימת החוגים</Link>
          </article>

          <article className="glass-panel info-panel">
            <div className="hero-badge" style={{ marginBottom: '1rem', background: '#fff7ed', color: '#c2410c' }}>
              <Info size={16} />
              למי שרוצה הכוונה
            </div>
            <h2>גם אם לא בטוחים מאיפה להתחיל</h2>
            <ul className="feature-list">
              {supportBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <Link href="/start" className="btn btn-secondary btn-md">הכוונה צעד אחר צעד</Link>
              <Link href="/chat" className="btn btn-primary btn-md">לדבר איתי פשוט</Link>
            </div>
          </article>
        </div>
      </section>

      <section className="showcase-section">
        <div className="container">
          <div className="features-header animate-fade-up">
            <h2 className="features-title">מה תמצאו באתר</h2>
            <p>המידע החשוב באמת לפני הרשמה, הגעה או התעדכנות.</p>
          </div>

          <div className="showcase-grid">
            {communityHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="showcase-card">
                  <div className={`feature-icon-wrapper ${item.tone}`}><Icon size={28} /></div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              );
            })}
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
            <h2>רוצים להתחיל ממשהו פשוט?</h2>
            <p>אפשר להתחיל ממסלול מודרך, לבדוק מה קורה השבוע או פשוט לכתוב בשפה חופשית מה אתם צריכים.</p>
          </div>
          <div className="hero-actions">
            <Link href="/start" className="btn btn-secondary btn-lg">להתחיל בהכוונה</Link>
            <Link href="/chat" className="btn btn-primary btn-lg">
              לדבר איתי פשוט
              <ArrowLeft size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
