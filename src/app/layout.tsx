import type { Metadata } from 'next';
import './globals.css';

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
      <body>
        {children}
      </body>
    </html>
  );
}
