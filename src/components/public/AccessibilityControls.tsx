'use client';

import { useEffect, useState } from 'react';
import { Eye, Type, WandSparkles } from 'lucide-react';

type AccessibilityMode = 'default' | 'comfort' | 'focus';

const STORAGE_KEY = 'matnas_accessibility_mode';

const options: Array<{
    id: AccessibilityMode;
    label: string;
    shortLabel: string;
    icon: typeof Eye;
}> = [
    { id: 'default', label: 'תצוגה רגילה', shortLabel: 'רגיל', icon: WandSparkles },
    { id: 'comfort', label: 'נגישות מוגברת', shortLabel: 'נגיש', icon: Type },
    { id: 'focus', label: 'מיקוד גבוה', shortLabel: 'מיקוד', icon: Eye },
];

function applyMode(mode: AccessibilityMode) {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.accessibilityMode = mode;
}

export default function AccessibilityControls() {
    const [mode, setMode] = useState<AccessibilityMode>(() => {
        if (typeof window === 'undefined') {
            return 'default';
        }

        const stored = window.localStorage.getItem(STORAGE_KEY) as AccessibilityMode | null;
        return stored && options.some((option) => option.id === stored) ? stored : 'default';
    });

    useEffect(() => {
        applyMode(mode);
    }, [mode]);

    function handleModeChange(nextMode: AccessibilityMode) {
        setMode(nextMode);
        applyMode(nextMode);
        window.localStorage.setItem(STORAGE_KEY, nextMode);
    }

    return (
        <div className="accessibility-controls" aria-label="אפשרויות נגישות">
            {options.map((option) => {
                const Icon = option.icon;

                return (
                    <button
                        key={option.id}
                        type="button"
                        className={`accessibility-chip ${mode === option.id ? 'is-active' : ''}`}
                        onClick={() => handleModeChange(option.id)}
                        aria-pressed={mode === option.id}
                        title={option.label}
                    >
                        <Icon size={15} />
                        <span>{option.shortLabel}</span>
                    </button>
                );
            })}
        </div>
    );
}
