import type { Metadata } from 'next';
import { Inter, Heebo } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const metadata: Metadata = {
  title: 'המתנס הדיגיטלי החכם',
  description: 'מערכת ניהול חכמה למרכזים קהילתיים כוללת צ\'אט בינה מלאכותית ויצירת תוכן לשיווק',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.variable} ${heebo.variable}`}>
        {children}
      </body>
    </html>
  );
}
