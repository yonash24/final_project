import { NextRequest, NextResponse } from 'next/server';
import { getStudioModel } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
    try {
        const { prompt, type, action, design } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'חסר תוכן לסטודיו' }, { status: 400 });
        }

        const model = getStudioModel();

        let combinedInstruction = '';

        if (action === 'get_designs') {
            combinedInstruction = `
אתה מעצב גרפי מקצועי. המשתמש רוצה ליצור פלייר עבור: "${prompt}".
הצע 4 אפשרויות עיצוב שונות. לכל אפשרות תן:
1. שם עיצוב (בעברית).
2. פלטת צבעים הכוללת: צבע ראשי, צבע משני, צבע טקסט, וצבע רקע (בפורמט HEX).
3. תיאור קצר של הסגנון (בעברית).
4. אייקון מתאים (מתוך Lucide React, למשל: "Sparkles", "PartyPopper", "Music", "Basketball").

החזר אובייקט JSON במבנה:
{
  "designs": [
    {
      "id": "1",
      "name": "שם",
      "description": "תיאור",
      "icon": "IconName",
      "palette": { "primary": "#hex", "secondary": "#hex", "text": "#hex", "bg": "#hex" }
    },
    ...
  ]
}
`;
        } else if (type === 'flyer' && action === 'generate') {
            combinedInstruction = `
אתה סטודיו שיווק גנרטיבי. צור תוכן מלא לפלייר עבור: "${prompt}".
העיצוב שנבחר הוא: ${design?.name || 'סטנדרטי'} עם פלטת צבעים: ${JSON.stringify(design?.palette || {})}.

עליך להחזיר אובייקט JSON במבנה הבא:
{
  "title": "כותרת קליטה וגדולה",
  "subtitle": "כותרת משנה מרגשת",
  "body": "פסקה שיווקית משכנעת",
  "highlights": ["נקודת חוזק 1", "נקודת חוזק 2", "נקודת חוזק 3"],
  "contact": "פרטי יצירת קשר (טלפון/אתר/כתובת)",
  "cta": "קריאה לפעולה (למשל: הירשמו עכשיו!)",
  "imagePrompt": "A very short English description (max 5 words) for an image fitting this flyer"
}

דגשים:
- הכל בעברית (חוץ מה-imagePrompt).
- השתמש בטון שמתאים לעיצוב ${design?.name || 'הקהילתי'}.
- שלב אימוג'ים בטקסט.
`;
        } else {
            // Legacy/Social Post
            combinedInstruction = `
אתה סטודיו שיווק גנרטיבי עבור "מתנ"ס - המרכז הקהילתי הדיגיטלי החכם".
התפקיד שלך הוא ליצור תוכן שיווקי מלא הכולל טקסט ותיאור ויזואלי.

המידע שסופק על ידי מנהל המתנ"ס:
"${prompt}"

עליך להחזיר אובייקט JSON במבנה הבא:
{
  "marketingText": "הטקסט השיווקי בעברית, אטרקטיבי, מרגש ומניע לפעולה. סוג: פוסט לרשתות חברתיות",
  "imagePrompt": "תיאור קצר מאוד באנגלית (עד 5 מילים) עבור תמונה שתתאים לתוכן זה"
}

דגשים לטקסט השיווקי:
- כתוב בעברית בלבד.
- שלב אימוג'י במידה מושלמת.
- שמור על רוח קהילתית וחמה.
`;
        }

        let responseText = '';
        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await model.generateContent(combinedInstruction);
                responseText = result.response.text();
                lastError = null;
                break;
            } catch (geminiErr: any) {
                lastError = geminiErr;
                const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
                const status = geminiErr?.status;
                if ((status === 429 || msg.includes('429')) && attempt < 2) {
                    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
                    continue;
                }
                break;
            }
        }

        if (lastError) throw lastError;
        
        const data = JSON.parse(responseText);

        if (action === 'get_designs') {
            return NextResponse.json(data);
        }

        const imageSearchTerm = data.imagePrompt?.trim().replace(/ /g, '_') || 'community_center';
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imageSearchTerm)}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        return NextResponse.json({ 
            ...data,
            imageUrl: imageUrl
        });
    } catch (err: any) {
        console.error('[Studio API]', err);
        if (err.status === 429) {
            return NextResponse.json({ error: 'חרגת ממכסת הבקשות. אנא נסה שוב בעוד דקה.' }, { status: 429 });
        }
        return NextResponse.json({ error: 'שגיאה פנימית בהפעלת מודל השיווק' }, { status: 500 });
    }
}
