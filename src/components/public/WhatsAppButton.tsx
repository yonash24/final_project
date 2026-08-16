'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type WhatsAppButtonProps = {
    className?: string;
    compact?: boolean;
    floating?: boolean;
    message?: string;
};

const defaultMessage = 'שלום, אשמח לקבל עזרה במציאת פעילות מתאימה.';

export default function WhatsAppButton({
    className = '',
    compact = false,
    floating = false,
    message = defaultMessage,
}: WhatsAppButtonProps) {
    const [phoneNumber, setPhoneNumber] = useState(process.env.NEXT_PUBLIC_WHATSAPP_CHAT_NUMBER?.replace(/\D/g, '') || '');

    useEffect(() => {
        if (phoneNumber) return;

        let active = true;
        fetch('/api/whatsapp/contact')
            .then((response) => response.ok ? response.json() as Promise<{ phoneNumber?: string | null }> : null)
            .then((data) => {
                if (active && data?.phoneNumber) setPhoneNumber(data.phoneNumber);
            })
            .catch(() => undefined);

        return () => { active = false; };
    }, [phoneNumber]);

    const href = phoneNumber
        ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
        : undefined;
    const label = compact ? 'WhatsApp' : 'דברו איתנו ב-WhatsApp';
    const classes = ['whatsapp-button', compact ? 'whatsapp-button-compact' : '', floating ? 'whatsapp-button-floating' : '', className]
        .filter(Boolean)
        .join(' ');

    return (
        <a
            href={href}
            className={classes}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            aria-disabled={!href}
            onClick={(event) => { if (!href) event.preventDefault(); }}
        >
            <MessageCircle size={compact ? 18 : 21} aria-hidden="true" />
            {!floating && <span>{label}</span>}
            {floating && <span className="whatsapp-button-tooltip">דברו איתנו ב-WhatsApp</span>}
        </a>
    );
}
