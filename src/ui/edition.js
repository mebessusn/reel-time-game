// Which edition is running: the free Five Lakes inside Claude (a single-file artifact build, `vite build --mode single`,
// or any page Claude hosts), or the standalone game (Steam, phones, the dev server). Copy that only makes sense beside
// Claude ("for the wait", linking Claude) is chosen here, so nothing else has to ask.
import { STANDALONE } from '../standalone.js';

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
/** True inside a Claude artifact. (?edition=claude on the dev server shows that edition's screens, for tests.) */
export const IN_CLAUDE = import.meta.env?.MODE === 'single' || (typeof window !== 'undefined' && !!window.claude?.use) || (!!import.meta.env?.DEV && q?.get('edition') === 'claude');
const CLAUDE_TAGLINE = 'A cozy lake for the wait.';
/** The line under the logo. The standalone game brings its own (src/standalone.js); the Five Lakes keeps the original. */
export const TAGLINE = (!IN_CLAUDE && STANDALONE.tagline) || CLAUDE_TAGLINE;
