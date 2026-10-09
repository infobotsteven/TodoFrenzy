import { customAlphabet } from 'nanoid';

// 16 znaków [0-9a-z] ≈ 82 bity - wystarczająco, by link do projektu był nie do odgadnięcia
export const newId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
