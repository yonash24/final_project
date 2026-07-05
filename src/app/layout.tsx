import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="he" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
