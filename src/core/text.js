// v1.17.10: small text helpers for lines built from names.
/** "a" or "an" for the word that follows: an Arctic Char, a Bluegill, an Ace. */
export const aan = (w) => (/^[aeiou]/i.test(String(w ?? '').trim()) ? 'an' : 'a');
