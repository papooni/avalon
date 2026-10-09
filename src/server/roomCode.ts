// Kept free of node:crypto so the client bundle can import it via protocol.ts.

// No 0/O, 1/I/L, so codes are easy to read aloud across a table.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const ROOM_CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
