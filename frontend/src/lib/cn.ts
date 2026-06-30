import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// cn merges Tailwind utility classes safely: clsx resolves conditionals, then
// tailwind-merge dedupes conflicting utilities (last wins). The single class
// composer for every primitive — replaces hand-typed inline styles.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
