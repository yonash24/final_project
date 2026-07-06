/**
 * seed-knowledge-and-embeddings.ts
 * 
 * Run with: npx tsx src/scripts/seed-knowledge-and-embeddings.ts
 * 
 * This script:
 * 1. Seeds the knowledge_base table with FAQs and center information
 * 2. Generates embeddings for all knowledge_base entries
 * 3. Generates embeddings for all activities (that don't have one yet)
 * 4. Generates embeddings for all events (that don't have one yet)
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_API_KEY!;

if (!supabaseUrl || !supabaseKey || !googleApiKey) {
    console.error('❌ Missing environment variables. Ensure .env.local is set up.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(googleApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

async function generateEmbedding(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

async function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// ─── Knowledge Base Seed Data ──────────────────────────

const KNOWLEDGE_ENTRIES = [
    {
        category: 'faq',
        title: 'Registration Process',
        title_he: 'איך נרשמים לחוג?',
        content: 'Registration process for activities at the community center.',
        content_he: 'ההרשמה לחוגים מתבצעת דרך האתר שלנו או בטלפון. אפשר להירשם ישירות דרך דף החוגים באתר, בלחיצה על כפתור "הרשמה" ליד כל חוג. לאחר מילוי שם וטלפון, נציג יצור קשר לאישור סופי תוך 24 שעות. אפשר גם להגיע פיזית למזכירות המתנ"ס.',
        tags: ['הרשמה', 'חוגים', 'איך להירשם', 'רישום'],
    },
    {
        category: 'hours',
        title: 'Opening Hours',
        title_he: 'שעות פתיחה של המתנ"ס',
        content: 'Community center opening hours.',
        content_he: 'המתנ"ס פתוח בימים א-ה בין השעות 08:00-21:00 ובימי שישי בין 08:00-13:00. בשבתות וחגים המתנ"ס סגור. המזכירות פעילה בימים א-ה בין 08:00-16:00.',
        tags: ['שעות', 'פתיחה', 'מתי פתוח', 'שעות עבודה'],
    },
    {
        category: 'contact',
        title: 'Contact Information',
        title_he: 'פרטי יצירת קשר',
        content: 'Contact details for the community center.',
        content_he: 'ניתן ליצור קשר עם המתנ"ס בטלפון: 08-1234567, בדוא"ל: info@matnas.org.il, או להגיע ישירות לכתובתנו. המזכירות זמינה לשאלות על חוגים, הרשמות, אירועים ומידע כללי.',
        tags: ['טלפון', 'אימייל', 'קשר', 'כתובת', 'מזכירות'],
    },
    {
        category: 'policy',
        title: 'Cancellation Policy',
        title_he: 'מדיניות ביטולים',
        content: 'Cancellation and refund policy.',
        content_he: 'ביטול הרשמה ניתן עד 14 יום לפני תחילת החוג עם החזר מלא. ביטול מאוחר יותר ועד 7 ימים לפני כרוך בתשלום של 20% מהעלות. לאחר תחילת החוג, ביטול יתאפשר רק במקרים חריגים ובאישור מנהל המתנ"ס.',
        tags: ['ביטול', 'החזר', 'מדיניות', 'כסף'],
    },
    {
        category: 'policy',
        title: 'Payment Methods',
        title_he: 'אמצעי תשלום',
        content: 'Accepted payment methods.',
        content_he: 'המתנ"ס מקבל תשלום במזומן, בכרטיסי אשראי (ויזה, מאסטרכארד), בהעברה בנקאית, ובמספר תשלומים ללא ריבית (עד 3 תשלומים). לפרטים נוספים ניתן לפנות למזכירות.',
        tags: ['תשלום', 'אשראי', 'מזומן', 'תשלומים'],
    },
    {
        category: 'faq',
        title: 'Trial Classes',
        title_he: 'שיעורי ניסיון',
        content: 'Information about trial classes.',
        content_he: 'ברוב החוגים אנחנו מציעים שיעור ניסיון חינם או בעלות סמלית. אפשר לתאם שיעור ניסיון ישירות דרך המזכירות או לשאול אותנו בצ\'אט. זו דרך מצוינת לבדוק אם החוג מתאים לפני ההרשמה הקבועה.',
        tags: ['ניסיון', 'שיעור', 'בדיקה', 'חינם'],
    },
    {
        category: 'faq',
        title: 'Family Discount',
        title_he: 'הנחות משפחה',
        content: 'Family discount information.',
        content_he: 'המתנ"ס מציע הנחות למשפחות שרושמות שני ילדים ומעלה. ההנחה היא 10% על הילד השני ו-15% על השלישי ומעלה. בנוסף, יש הנחות לאוכלוסיות מיוחדות — פנו למזכירות לפרטים.',
        tags: ['הנחה', 'משפחה', 'ילדים', 'מחיר'],
    },
    {
        category: 'general',
        title: 'Parking and Access',
        title_he: 'חניה ונגישות',
        content: 'Parking and accessibility information.',
        content_he: 'למתנ"ס יש חניון עם 30 מקומות חניה חינמיים, כולל 3 מקומות נכים. המבנה נגיש לחלוטין עם כבש, מעלית וחדרי שירותים מותאמים. ניתן להגיע גם בתחבורה ציבורית — תחנת אוטובוס בקרבת מקום.',
        tags: ['חניה', 'נגישות', 'הגעה', 'אוטובוס', 'נכים'],
    },
    {
        category: 'faq',
        title: 'Age Requirements',
        title_he: 'דרישות גיל',
        content: 'Age requirements for different activities.',
        content_he: 'לכל חוג יש דרישות גיל מוגדרות. חוגים לילדים בדרך כלל מגיל 3 ומעלה. יש חוגי נוער (12-18), חוגים למבוגרים (18+), ופעילויות לגיל השלישי (60+). הגיל המדויק מצוין בפרטי כל חוג. אם אתם לא בטוחים, שאלו אותנו!',
        tags: ['גיל', 'ילדים', 'מבוגרים', 'נוער', 'קשישים'],
    },
    {
        category: 'faq',
        title: 'Waitlist Process',
        title_he: 'רשימת המתנה',
        content: 'How the waitlist works.',
        content_he: 'כשחוג מלא, אפשר להירשם לרשימת המתנה. כשמתפנה מקום, נודיע לכם מיד בהודעה (ווטסאפ או טלפון). מקומות מתפנים בדרך כלל תוך 2-3 שבועות. אין עלות על ההמתנה ברשימה.',
        tags: ['המתנה', 'רשימה', 'מלא', 'מקום פנוי'],
    },
    {
        category: 'general',
        title: 'About the Community Center',
        title_he: 'על המתנ"ס שלנו',
        content: 'General information about the community center.',
        content_he: 'המתנ"ס הקהילתי שלנו פועל כבר מעל 20 שנה ומציע מגוון רחב של חוגים, פעילויות ואירועים לכל הגילאים. אנחנו כאן כדי לחבר בין אנשים, להעשיר את הקהילה, ולספק חוויות למידה והנאה. אצלנו תמצאו חוגי ספורט, אומנות, מוזיקה, מחשבים, שפות ועוד.',
        tags: ['אודות', 'מתנס', 'מידע כללי', 'קהילה'],
    },
];

// ─── Main Execution ────────────────────────────────────

async function main() {
    console.log('🚀 Starting knowledge base seeding and embedding generation...\n');

    // Step 1: Seed knowledge base
    console.log('📚 Step 1: Seeding knowledge base...');
    for (const entry of KNOWLEDGE_ENTRIES) {
        const { error } = await supabase
            .from('knowledge_base')
            .upsert(entry, { onConflict: 'title_he' });

        if (error) {
            console.log(`  ⚠️ Could not insert "${entry.title_he}": ${error.message}`);
        } else {
            console.log(`  ✅ ${entry.title_he}`);
        }
    }

    // Step 2: Generate embeddings for knowledge base
    console.log('\n🧠 Step 2: Generating knowledge base embeddings...');
    const { data: kbRows } = await supabase
        .from('knowledge_base')
        .select('id, title_he, content_he, category, tags')
        .is('embedding', null);

    if (kbRows && kbRows.length > 0) {
        for (const kb of kbRows) {
            try {
                const text = [kb.title_he, kb.content_he, kb.category, ...(kb.tags || [])].filter(Boolean).join('. ');
                const embedding = await generateEmbedding(text);
                await supabase.from('knowledge_base').update({ embedding }).eq('id', kb.id);
                console.log(`  ✅ Embedded: ${kb.title_he}`);
                await delay(300);
            } catch (err) {
                console.log(`  ❌ Failed: ${kb.title_he}`, err);
            }
        }
    } else {
        console.log('  ℹ️ All knowledge base entries already have embeddings.');
    }

    // Step 3: Generate embeddings for activities
    console.log('\n🎨 Step 3: Generating activity embeddings...');
    const { data: activities } = await supabase
        .from('activities')
        .select('id, title_he, description_he, target_age_group, days_of_week, location, instructor_name, categories(name_he)')
        .eq('is_active', true)
        .is('embedding', null);

    if (activities && activities.length > 0) {
        for (const act of activities) {
            try {
                const catName = (act.categories as unknown as { name_he: string } | null)?.name_he || '';
                const text = [act.title_he, act.description_he, act.target_age_group, act.days_of_week, act.location, act.instructor_name, catName].filter(Boolean).join('. ');
                const embedding = await generateEmbedding(text);
                await supabase.from('activities').update({ embedding }).eq('id', act.id);
                console.log(`  ✅ Embedded: ${act.title_he}`);
                await delay(300);
            } catch (err) {
                console.log(`  ❌ Failed: ${act.title_he}`, err);
            }
        }
    } else {
        console.log('  ℹ️ All activities already have embeddings.');
    }

    // Step 4: Generate embeddings for events
    console.log('\n📅 Step 4: Generating event embeddings...');
    const { data: events } = await supabase
        .from('events')
        .select('id, title, description, location, category, type')
        .eq('is_published', true)
        .is('embedding', null);

    if (events && events.length > 0) {
        for (const evt of events) {
            try {
                const text = [evt.title, evt.description, evt.location, evt.category, evt.type].filter(Boolean).join('. ');
                const embedding = await generateEmbedding(text);
                await supabase.from('events').update({ embedding }).eq('id', evt.id);
                console.log(`  ✅ Embedded: ${evt.title}`);
                await delay(300);
            } catch (err) {
                console.log(`  ❌ Failed: ${evt.title}`, err);
            }
        }
    } else {
        console.log('  ℹ️ All events already have embeddings.');
    }

    console.log('\n✨ Done! All embeddings generated successfully.');
}

main().catch(console.error);
