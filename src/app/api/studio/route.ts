import { NextRequest, NextResponse } from 'next/server';
import { getClassifierModel } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
    try {
        const { prompt, type } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'חסר תוכן לסטודיו' }, { status: 400 });
        }

        const model = getClassifierModel();

        const systemInstruction = `
אתה סטודיו שיווק גנרטיבי עבור "מתנ"ס - המרכז הקהילתי הדיגיטלי החכם".
התפקיד שלך הוא לכתוב תוכן שיווקי אטרקטיבי, מרגש ומניע לפעולה, המיועד לתושבים בישראל.
חובה לכתוב בעברית, לשלב אימוג'י במידה מושלמת, ולשמור על רוח קהילתית וחמה.

סוג התוכן המבוקש: ${type === 'flyer' ? 'עיצוב רעיוני וטקסט לפלייר תמציתי (כולל כותרת קצרה וקליטה)' : 'פוסט שיווקי לרשתות החברתיות המניע להרשמה (קצר וקולע)'}.

המידע שסופק מנהל המתנ"ס:
${prompt}

החזר רק את התוכן הסופי המוכן לפרסום, ללא הקדמות.
`;

        const result = await model.generateContent(systemInstruction);
        const text = result.response.text();

        return NextResponse.json({ content: text });
    } catch (err) {
        console.error('[Studio API]', err);
        return NextResponse.json({ error: 'שגיאה פנימית בהפעלת מודל השיווק' }, { status: 500 });
    }
}
