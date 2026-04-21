import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, LayoutDashboard, Palette, Sparkles } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

export default function Home() {
  return (
    <>
      <div className="container">
        {/* Navigation */}
        <Navbar />

        {/* Hero Section */}
        <header className="hero">
          <div className="hero-content animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="hero-badge">
              <Sparkles size={16} className="mr-2" />
              הדור הבא של המרכזים הקהילתיים
            </div>
            <h1 className="hero-title">
              ניהול מתנ"ס <span>חכם</span>,<br /> קהילה <span>מחוברת</span>.
            </h1>
            <p className="hero-subtitle">
              מערכת ניהול מתקדמת וידידותית שמשנה את כללי המשחק. נהל חוגים ואירועים, צור תוכן שיווקי בכפתור אחד, ואפשר לתושבים לשאול שאלות ולקבל תשובות מידיות מבוססות AI.
            </p>

            <div className="hero-actions">
              <Link href="/chat" className="btn btn-primary btn-lg">
                <MessageSquare size={20} />
                נסה את הצ'אט החכם
              </Link>
              <Link href="/admin" className="btn btn-secondary btn-lg">
                <LayoutDashboard size={20} />
                לפנל הניהול
              </Link>
            </div>
          </div>

          <div className="hero-image-wrapper animate-fade-up animate-float" style={{ animationDelay: '0.4s' }}>
            <Image
              src="/images/hero.png"
              alt="Community Center Illustration"
              width={800}
              height={600}
              priority
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </header>
      </div>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-header animate-fade-up">
          <h2 className="features-title">הכלים שלנו לבניית קהילה</h2>
          <p>פלטפורמה אחת שמחברת בין ההנהלה לתושבים.</p>
        </div>

        <div className="features-grid">

          <div className="feature-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="feature-icon-wrapper icon-blue">
              <MessageSquare size={32} />
            </div>
            <h3>צ'אט חכם מבוסס AI</h3>
            <p>מענה על שאלות חופשיות במלל טבעי. התושב שואל "האם יש חוגים לבני 10 ביום שני?" - הצ'אט מוצא במאגר ועונה מיידית 24/7 בסבלנות.</p>
          </div>

          <div className="feature-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="feature-icon-wrapper icon-orange">
              <LayoutDashboard size={32} />
            </div>
            <h3>ניהול חוגים מקיף</h3>
            <p>ממשק מתקדם וידידותי למנהלי המתנס. ניהול קל ונוח של חוגים, תאריכים, סיווגים משתתפים ומדריכים במקום אחד מסודר.</p>
          </div>

          <div className="feature-card animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="feature-icon-wrapper icon-green">
              <Palette size={32} />
            </div>
            <h3>סטודיו שיווק גנרטיבי</h3>
            <p>בלחיצת כפתור אחת מנוע ה-AI יכתוב טקסט שיווקי אטרקטיבי ואף יעצב פלייר גרפי חד ומרהיב המותאם מיידית לחוג הספציפי.</p>
          </div>

        </div>
      </section>
    </>
  );
}
