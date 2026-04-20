import Link from 'next/link';
import { MessageSquare, LayoutDashboard, Palette, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-[1200px] mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-accent-blue" />
            <div className="absolute inset-0 bg-accent-blue blur-xl opacity-50"></div>
          </div>
          <span className="font-bold text-xl text-white">מרכז דיגיטלי<br />קהילתי</span>
        </div>

        <div className="hidden md:flex gap-6 items-center text-text-secondary">
          <Link href="/" className="hover:text-white transition-colors">בית</Link>
          <Link href="#features" className="hover:text-white transition-colors">תכונות</Link>
          <Link href="/admin" className="hover:text-white transition-colors">ניהול הקהילה</Link>
        </div>

        <div className="flex gap-4">
          <Link href="/admin/login" className="px-5 py-2 glass-panel text-white hover:border-accent-blue hover:text-accent-blue transition-colors">
            התחברות מנהלים
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container flex-col items-center justify-center flex-1 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          המתנס הדיגיטלי החכם
        </h1>
        <p className="text-lg md:text-xl text-text-secondary max-w-[600px] mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          מערכת ניהול מתקדמת וידידותית. נהל חוגים, צור תוכן שיווקי בכפתור אחד, ואפשר לתושבים לשאול שאלות דרך צ'אט AI חכם.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Link href="/chat" className="px-8 py-4 bg-accent-blue text-white rounded-full font-bold text-lg hover:bg-accent-blue-hover transition-colors shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            נסה את ה-AI צ'אט לתושב
          </Link>
          <Link href="/admin" className="px-8 py-4 glass-panel text-white rounded-full font-bold text-lg hover:border-accent-gold transition-colors">
            לפנל הניהול
          </Link>
        </div>

        {/* Feature Cards */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 animate-slide-up" style={{ animationDelay: '0.5s', width: '100%' }}>

          <div className="glass-panel p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-accent-blue" />
            </div>
            <h3 className="text-2xl font-bold mb-3">צ'אט AI לתושבים</h3>
            <p className="text-text-secondary">מענה על שאלות חופשיות במלל טבעי. "האם יש חוגים לבני 10 ביום שני?" - הצ'אט מוצא ועונה!</p>
          </div>

          <div className="glass-panel p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(245,158,11,0.1)] flex items-center justify-center mb-6">
              <LayoutDashboard className="w-8 h-8 text-accent-gold" />
            </div>
            <h3 className="text-2xl font-bold mb-3">ניהול פעילויות מקיף</h3>
            <p className="text-text-secondary">ממשק מתקדם וידידותי למנהלי המתנס. ניהול חוגים, תאריכים, סיווגים ומשתתפים במקום אחד.</p>
          </div>

          <div className="glass-panel p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(16,185,129,0.1)] flex items-center justify-center mb-6">
              <Palette className="w-8 h-8 text-accent-emerald" />
            </div>
            <h3 className="text-2xl font-bold mb-3">פרסום גנרטיבי</h3>
            <p className="text-text-secondary">לחיצת כפתור אחת ומנוע ה-AI יכתוב פוסט פרסומי ויעצב פלייר גרפי מותאם לחוג הספציפי.</p>
          </div>

        </div>
      </main>
    </div>
  );
}
