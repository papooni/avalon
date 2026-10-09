import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { plural } from './text';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
