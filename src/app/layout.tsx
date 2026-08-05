import type { Metadata } from 'next';
import { Heebo, Rubik } from 'next/font/google';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['700', '800', '900'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'המתנ"ס הדיגיטלי',
  description: 'כל המידע על חוגים, אירועים, עדכוני קהילה ועזרה מהירה במקום אחד נעים ופשוט.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${rubik.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">דלג לתוכן</a>
        {children}
      </body>
    </html>
  );
}
