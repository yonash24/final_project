/**
 * chat-constants.ts
 * Client-safe constants for the chat UI.
 * Exported separately from prompts.ts (server-only) so they can be
 * safely imported by 'use client' components without bundling server code.
 */

export const GREETING_MESSAGE = `שלום! 👋 אני מתני, הנציג הווירטואלי של המתנ"ס שלנו.

אני יכול לעזור לך למצוא:
🎨 **חוגים ופעילויות** - לכל הגילאים
📅 **אירועים קרובים** - מה קורה אצלנו
💰 **מחירים ופרטים** - על כל פעילות

אם לא בטוחים מאיפה להתחיל, פשוט כתבו לי מה אתם צריכים במילים שלכם ואני אעשה סדר. 😊`;

export const QUICK_ACTIONS = [
    { label: '🌱 אני לא יודע/ת מאיפה להתחיל', message: 'אני לא יודעת מאיפה להתחיל, תוכלו לכוון אותי?' },
    { label: '🎯 פעילויות לילדים', message: 'יש פעילויות מתאימות לילדים?' },
    { label: '📅 אירועים השבוע', message: 'אילו אירועים יש בשבוע הקרוב?' },
    { label: '🧘 חוגים למבוגרים', message: 'מה יש למבוגרים?' },
    { label: '👴 פעילויות לקשישים', message: 'אילו פעילויות יש לקשישים?' },
    { label: '💰 חוגים חינם', message: 'יש חוגים בחינם?' },
    { label: '👨‍👩‍👧 משהו לכל המשפחה', message: 'יש פעילויות שמתאימות לכל המשפחה?' },
];
