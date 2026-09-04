"use client";

import { FileSpreadsheet, CheckCircle2, UploadCloud, ArrowLeftRight, DatabaseZap } from 'lucide-react';
import { useState } from 'react';

import AdminNavbar from '@/components/admin/AdminNavbar';
import type { ImportMapping } from '@/lib/admin/activity-import';
import { IMPORTABLE_FIELDS } from '@/lib/admin/import-constants';
import type { ImportJob, ImportRowResult } from '@/lib/admin/types';

type Step = 'upload' | 'mapping' | 'preview' | 'done';

const FIELD_LABELS: Record<(typeof IMPORTABLE_FIELDS)[number], string> = {
    title_he: 'שם חוג',
    description_he: 'תיאור',
    category: 'קטגוריה',
    target_age_group: 'קהל יעד',
    min_age: 'גיל מינימלי',
    max_age: 'גיל מקסימלי',
    days_of_week: 'ימים',
    start_time: 'שעת התחלה',
    end_time: 'שעת סיום',
    price: 'מחיר',
    instructor_name: 'מדריך',
    location: 'מיקום',
    max_participants: 'מכסה',
    venue: 'מקום',
    group_name: 'קבוצה',
    contact_name: 'איש קשר',
    contact_phone: 'טלפון',
    contact_email: 'דוא״ל',
    notes: 'הערות',
    min_grade: 'כיתה מינימלית',
    max_grade: 'כיתה מקסימלית',
    is_active: 'פעיל',
};

export default function AdminClassesImportPage() {
    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<ImportMapping>({});
    const [previewRows, setPreviewRows] = useState<ImportRowResult[]>([]);
    const [job, setJob] = useState<ImportJob | null>(null);
    const [summary, setSummary] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [publuuUrl, setPubluuUrl] = useState('');
    const [publuuPdfUrl, setPubluuPdfUrl] = useState('');
    const [approvedRows, setApprovedRows] = useState<Set<number>>(new Set());

    async function inspectFile(selectedFile: File) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (publuuUrl.trim()) formData.append('publuuUrl', publuuUrl.trim());
        if (publuuPdfUrl.trim()) formData.append('publuuPdfUrl', publuuPdfUrl.trim());

        const response = await fetch('/api/admin/activity-import/preview', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to inspect file');

        setHeaders(data.headers);
        setSampleRows(data.sampleRows);
        setMapping(data.suggestedMapping ?? {});
        setStep('mapping');
    }

    async function buildPreview() {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mapping', JSON.stringify(mapping));
        if (publuuUrl.trim()) formData.append('publuuUrl', publuuUrl.trim());
        if (publuuPdfUrl.trim()) formData.append('publuuPdfUrl', publuuPdfUrl.trim());

        const response = await fetch('/api/admin/activity-import/preview', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create preview');

        setJob(data.job);
        setPreviewRows(data.previewRows);
        setApprovedRows(new Set());
        setStep('preview');
    }

    async function commitImport() {
        if (!job) return;

        const response = await fetch('/api/admin/activity-import/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id, approvedRowIndexes: [...approvedRows], rowEdits: previewRows.filter((row) => approvedRows.has(row.rowIndex)).map((row) => ({ rowIndex: row.rowIndex, payload: row.payload })) }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Import failed');

        setSummary(data);
        setStep('done');
    }

    function editRow(rowIndex: number, field: keyof ImportRowResult['payload'], value: string) {
        setPreviewRows((rows) => rows.map((row) => row.rowIndex === rowIndex ? { ...row, payload: { ...row.payload, [field]: ['min_age', 'max_age', 'price', 'max_participants'].includes(field) ? (value === '' ? null : Number(value)) : (value === '' ? null : value) } } : row));
    }

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setIsLoading(true);
        try {
            await inspectFile(selectedFile);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'שגיאה בקריאת הקובץ';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <AdminNavbar />
            <main className="container" style={{ padding: '2rem 0', maxWidth: '1100px' }}>
                {error && (
                    <div role="alert" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca' }}>
                        {error}
                    </div>
                )}
                <header style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ייבוא חוגים מאקסל</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>העלאה, מיפוי, Preview ואישור לפני כתיבה למערכת.</p>
                </header>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    {[
                        { id: 'upload', label: 'העלאה', icon: <UploadCloud size={16} /> },
                        { id: 'mapping', label: 'מיפוי', icon: <ArrowLeftRight size={16} /> },
                        { id: 'preview', label: 'Preview', icon: <FileSpreadsheet size={16} /> },
                        { id: 'done', label: 'אישור', icon: <DatabaseZap size={16} /> },
                    ].map(({ id, label, icon }) => (
                        <div key={id} className="hero-badge" style={{ opacity: step === id ? 1 : 0.55 }}>
                            {icon}
                            <span style={{ marginInlineStart: '0.4rem' }}>{label}</span>
                        </div>
                    ))}
                </div>

                {step === 'upload' && (
                    <div className="card" style={{ padding: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '1rem' }}>
                            <span style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem' }}>קישור Publuu (רשות)</span>
                            <input className="input-field" type="url" dir="ltr" placeholder="https://publuu.com/flip-book/..." value={publuuUrl} onChange={(event) => setPubluuUrl(event.target.value)} />
                            <small style={{ color: 'var(--text-secondary)' }}>הקישור נשמר כמקור לצורך provenance.</small>
                            <input className="input-field" type="url" dir="ltr" placeholder="קישור PDF רשמי מהורדת Publuu (רשות)" value={publuuPdfUrl} onChange={(event) => setPubluuPdfUrl(event.target.value)} style={{ marginTop: '0.5rem' }} />
                            <small style={{ color: 'var(--text-secondary)' }}>
                                איך משיגים את הקישור: פתחו את חוברת ה־Publuu, לחצו על כפתור ההורדה (סמל ⭳) בסרגל הצופה, והדביקו כאן את הקישור שנפתח או שממנו מתחילה ההורדה.
                                אם הכפתור לא מופיע, יש לבקש מבעל החשבון להפעיל את אפשרות &quot;הורדת PDF&quot; בהגדרות החוברת (CUSTOMIZE → MENU → DOWNLOAD PDF).
                                אם עדיין אין קישור PDF רשמי זמין, יש להעלות את ה־PDF המקורי בשדה הבא.
                            </small>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', gap: '1rem' }}>
                            <UploadCloud size={42} color="var(--accent-primary)" />
                            <div style={{ fontWeight: 700 }}>בחר CSV, Excel, Word או PDF</div>
                            <p style={{ color: 'var(--text-secondary)' }}>המערכת תחלץ נתונים ותציג אותם לבדיקה לפני שמירה.</p>
                            <input type="file" accept=".xlsx,.csv,.doc,.docx,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                        </label>
                        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', lineHeight: 1.7 }}>
                            <strong>מבנה CSV מומלץ</strong>
                            <div style={{ direction: 'ltr', marginTop: '0.5rem', fontFamily: 'monospace', overflowX: 'auto' }}>
                                title_he,description_he,category,target_age_group,min_age,max_age,days_of_week,start_time,end_time,price,instructor_name,location,max_participants,is_active
                            </div>
                            <small style={{ color: 'var(--text-secondary)' }}>
                                חובה: title_he. הערכים ל־target_age_group הם kids/teens/adults/seniors; שעה בפורמט HH:MM; is_active הוא true/false. אפשר להשתמש גם בכותרות בעברית.
                            </small>
                        </div>
                        {isLoading && <p style={{ marginTop: '1rem', textAlign: 'center' }}>מנתח את הקובץ...</p>}
                    </div>
                )}

                {step === 'mapping' && (
                    <div className="card" style={{ padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>מיפוי עמודות</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {IMPORTABLE_FIELDS.map((field) => (
                                <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600 }}>{FIELD_LABELS[field]}</span>
                                    <select
                                        className="input-field"
                                        value={mapping[field] ?? ''}
                                        onChange={(event) => setMapping((prev) => ({ ...prev, [field]: event.target.value || undefined }))}
                                    >
                                        <option value="">לא ממופה</option>
                                        {headers.map((header) => (
                                            <option key={header} value={header}>{header}</option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{ marginBottom: '0.75rem' }}>דוגמת שורות</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            {headers.map((header) => (
                                                <th key={header} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sampleRows.map((row, index) => (
                                            <tr key={index}>
                                                {headers.map((header) => (
                                                    <td key={header} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>{row[header]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            style={{ marginTop: '2rem' }}
                            onClick={() => {
                                setError(null);
                                setIsLoading(true);
                                void buildPreview().catch((caught) => setError(caught instanceof Error ? caught.message : 'שגיאה ביצירת התצוגה המקדימה')).finally(() => setIsLoading(false));
                            }}
                            disabled={isLoading}
                        >
                            בנה Preview
                        </button>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="card" style={{ padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Preview לפני ייבוא</h2>
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            `חדש`: {previewRows.filter((row) => row.status === 'new').length} ·
                            ` לעדכון`: {previewRows.filter((row) => row.status === 'update_candidate').length} ·
                            ` שגויות`: {previewRows.filter((row) => row.status === 'invalid').length}
                        </p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>אישור</th>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>שורה</th>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>סטטוס</th>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>שם חוג</th>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>ימים/שעה</th>
                                        <th style={{ padding: '0.75rem', background: 'var(--bg-secondary)' }}>שגיאות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((row) => (
                                        <tr key={row.rowIndex}>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                <input type="checkbox" disabled={row.status === 'invalid'} checked={approvedRows.has(row.rowIndex)} onChange={(event) => setApprovedRows((current) => {
                                                    const next = new Set(current);
                                                    if (event.target.checked) next.add(row.rowIndex); else next.delete(row.rowIndex);
                                                    return next;
                                                })} aria-label={`אישור שורה ${row.rowIndex}`} />
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>{row.rowIndex}</td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                                {row.status === 'new' ? 'חדש' : row.status === 'update_candidate' ? 'לעדכון' : 'שגוי'}
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}><input className="input-field" value={row.payload.title_he} onChange={(event) => editRow(row.rowIndex, 'title_he', event.target.value)} /></td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                <input className="input-field" value={row.payload.days_of_week || ''} onChange={(event) => editRow(row.rowIndex, 'days_of_week', event.target.value)} placeholder="יום" />
                                                <input className="input-field" type="time" value={row.payload.start_time || ''} onChange={(event) => editRow(row.rowIndex, 'start_time', event.target.value)} />
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', color: '#b91c1c' }}>
                                                {[...row.errors, ...(row.warnings ?? [])].join(', ') || 'תקין'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            style={{ marginTop: '2rem' }}
                            onClick={() => {
                                setError(null);
                                setIsLoading(true);
                                void commitImport().catch((caught) => setError(caught instanceof Error ? caught.message : 'שגיאה באישור הייבוא')).finally(() => setIsLoading(false));
                            }}
                            disabled={isLoading || approvedRows.size === 0}
                        >
                            אשר ייבוא
                        </button>
                    </div>
                )}

                {step === 'done' && summary && (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: '1rem' }} />
                        <h2 style={{ marginBottom: '0.75rem' }}>הייבוא הושלם</h2>
                        <p>נוספו {summary.imported} חוגים, עודכנו {summary.updated}, ודולגו {summary.skipped}.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
