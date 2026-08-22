export type ActivityInterest =
    | 'creative'
    | 'sports'
    | 'music'
    | 'dance'
    | 'technology'
    | 'educational'
    | 'social'
    | 'wellness'
    | 'theater'
    | 'family';

export const ACTIVITY_INTEREST_ALIASES: Record<ActivityInterest, readonly string[]> = {
    creative: ['יצירתי', 'יצירה', 'אמנות', 'אומנות', 'ציור', 'פיסול', 'קרמיקה', 'מלאכת יד', 'צילום'],
    sports: ['ספורט', 'ספורטיבי', 'פעילות גופנית', 'כושר', 'תנועה', 'כדורגל', 'כדורסל', 'התעמלות', 'אומנויות לחימה'],
    music: ['מוזיקה', 'מוסיקה', 'שירה', 'כלי נגינה', 'גיטרה', 'פסנתר'],
    dance: ['ריקוד', 'מחול', 'בלט', 'סלסה'],
    technology: ['מחשבים', 'תכנות', 'רובוטיקה', 'טכנולוגיה', 'מדעים', 'מדע'],
    educational: ['לימודי', 'חינוכי', 'למידה', 'העשרה', 'אנגלית'],
    social: ['חברתי', 'חברה', 'קהילה'],
    wellness: ['רגוע', 'רוגע', 'יוגה', 'מדיטציה', 'נשימות', 'בריאות', 'רווחה'],
    theater: ['תיאטרון', 'תאטרון', 'משחק', 'דרמה', 'הופעה'],
    family: ['משפחתי', 'משפחה', 'הורים וילדים'],
};

export function interestsFromText(text: string): ActivityInterest[] {
    const normalized = text.toLocaleLowerCase('he-IL');
    return (Object.entries(ACTIVITY_INTEREST_ALIASES) as [ActivityInterest, readonly string[]][])
        .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
        .map(([interest]) => interest);
}

export function interestLabel(interest: ActivityInterest): string {
    return {
        creative: 'יצירה ואמנות', sports: 'ספורט', music: 'מוזיקה', dance: 'ריקוד',
        technology: 'טכנולוגיה ומדעים', educational: 'העשרה', social: 'פעילות חברתית',
        wellness: 'רוגע ובריאות', theater: 'תיאטרון והופעה', family: 'פעילות משפחתית',
    }[interest];
}
