import { type ClassValue, clsx } from "clsx"

/**
 * Utility function to merge CSS classes.
 * Since we are not using Tailwind, we just rely on clsx.
 */
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs)
}
