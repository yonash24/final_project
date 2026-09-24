# Smart Hub – הוראות התקנה והפעלה

מדריך קצר למי שמקבל את הפרויקט ומקים אותו בסביבה חדשה.

## דרישות מוקדמות

- Node.js בגרסה 20.9 ומעלה
- חשבון Supabase עם פרויקט חדש
- מפתח Google Gemini API
- Git
- אופציונלי: Meta WhatsApp Cloud API או Twilio WhatsApp

## התקנה

    git clone <כתובת-ה-repository>
    cd final_project
    npm install

יוצרים קובץ .env.local לפי .env.example וממלאים את הערכים.

## מפתחות חובה

    NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    SUPABASE_SERVICE_ROLE_KEY=...
    GOOGLE_API_KEY=...

את מפתחות Supabase מוצאים ב־Supabase Dashboard → Project Settings → API.
את GOOGLE_API_KEY מקבלים מ־Google AI Studio. SUPABASE_SERVICE_ROLE_KEY סודי ואין לחשוף אותו בדפדפן או להעלות ל־Git.

## משתנים מומלצים לשרת

    AUDIT_IP_HASH_SALT=מחרוזת-אקראית-ארוכה
    APP_BASE_URL=https://כתובת-האתר.example
    NOTIFICATIONS_CRON_SECRET=מחרוזת-סודית-אקראית
    CHAT_KNOWLEDGE_VERSION=v1
    GEMINI_CHAT_MODEL=gemini-3-flash-preview

APP_BASE_URL צריך להיות HTTPS בשרת. NOTIFICATIONS_CRON_SECRET מגן על משימות הרקע.

## WhatsApp – אופציונלי

יש לבחור ספק אחד בלבד.

Meta:

    META_WHATSAPP_ACCESS_TOKEN=...
    META_WHATSAPP_VERIFY_TOKEN=...
    META_WHATSAPP_APP_SECRET=...
    META_GRAPH_API_VERSION=v23.0
    NEXT_PUBLIC_WHATSAPP_CHAT_NUMBER=מספר-בפורמט-בינלאומי-ללא-+

בנוסף למשתני הסביבה, מגדירים במסך ניהול ההתראות:

- Meta Phone Number ID
- Meta Business Account ID
- שמות תבניות מאושרות והשפה שלהן

ב־Meta Developers מגדירים את ה־Webhook לכתובת:

    https://הדומיין.example/api/webhooks/whatsapp/meta-cloud-api

משתמשים באותו Verify Token שמוגדר ב־META_WHATSAPP_VERIFY_TOKEN ומפעילים הרשאות
WhatsApp Business לניהול הודעות.

Twilio:

    TWILIO_ACCOUNT_SID=...
    TWILIO_AUTH_TOKEN=...

במסך ניהול ההתראות מגדירים:

- מספר שולח WhatsApp של Twilio, כולל הקידומת whatsapp:
- Content SID לכל תבנית הודעה, אם משתמשים בתבניות
- כתובת callback אם לא משתמשים ב־APP_BASE_URL

ב־Twilio Console מגדירים את כתובת ה־webhook:

    https://הדומיין.example/api/webhooks/whatsapp/twilio-whatsapp

מוודאים שהמספר מאושר לשליחת WhatsApp ושה־Auth Token תואם לחתימת ה־webhook.

הרשאות שינוי דרך WhatsApp כבויות כברירת מחדל:

    WHATSAPP_ADMIN_MUTATIONS_ENABLED=false
    WHATSAPP_ADMIN_PILOT_PHONES=

## בסיס נתונים

1. פותחים פרויקט חדש ב־Supabase.
2. ב־SQL Editor מריצים את קבצי supabase/migrations/ לפי הסדר המספרי, מ־0001 ועד האחרון.
3. מיגרציות 0009, 0010 ו־0016 הן מיגרציות ריקות בכוונה. הן לא יוצרות משתמש קבוע ולא מאפסות טבלאות.
4. אם צריך מידע התחלתי, מריצים גם את supabase/seed.sql.
5. להוספת ידע ו־embeddings:

    npx tsx src/scripts/seed-knowledge-and-embeddings.ts

הסקריפט קורא את .env.local ומחייב את מפתחות Supabase ו־Google.

## משתמש מנהל

מריצים פעם אחת עם פרטי מנהל חדשים:

    ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='סיסמה-חזקה' \
    npx tsx src/scripts/ensure-admin.ts

המשתמש נוצר ב־Supabase Auth ומקבל הרשאת super_admin. האימות עדיין נדרש
לאזור הניהול; רק יצירת האדמין הקבועה דרך migrations הוסרה.

## הפעלה

פיתוח:

    npm run dev

פותחים: http://localhost:3000

בדיקות ובדיקת קוד:

    npm test
    npm run lint

Production:

    npm run build
    npm run start

ב־Vercel מגדירים את אותם משתני סביבה ב־Project Settings. קובץ vercel.json מגדיר את משימות הרקע.

## Google Gemini ו־Vercel

- מפעילים את Gemini API בפרויקט Google Cloud ומוודאים שה־API key פעיל.
- אם יש שימוש משמעותי, מגדירים Billing, תקציב והתראות חריגה, וכן מגבלות שימוש (quotas).
- ב־Vercel מוודאים שה־Cron Jobs זמינים בתוכנית החשבון.
- מגדירים את NOTIFICATIONS_CRON_SECRET ב־Vercel. משימות הרקע הן:
  - /api/notifications/process?limit=20 כל 5 דקות
  - /api/cron/precompute כל 15 דקות
- אחרי הפריסה בודקים את /api/health ואת ה־Logs של Vercel.

## בדיקה מהירה

- דף הבית נטען.
- צ'אט AI מחזיר תשובה.
- /api/health מציג את השירותים שהוגדרו.
- כניסה לאזור הניהול עובדת.
- אם הוגדר WhatsApp, כתובת ה־webhook מוגדרת אצל הספק ו־APP_BASE_URL הוא HTTPS.

## אבטחה

- לא משתפים את .env.local.
- לא חושפים מפתחות Service Role, Gemini או WhatsApp בצד הלקוח.
- לא מפעילים ADMIN_AUTH_BYPASS ב־Production.
