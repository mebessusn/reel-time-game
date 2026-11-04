// The credits screen (title menu and pause menu > Credits). Another map adds its own lines with addCredits.
export const CREDITS = [
  { head: 'Made by', lines: ['Megan Bess', 'Top Game Development Company LLC'] },
  { head: 'Built with', lines: ['three.js (3D)', 'Vite (build tools)', 'Lucide (icons)'] },
  { head: '3D models', lines: ['Polyfork (low-poly models, polyfork.dev)', 'Everything else modelled in Blender for Reel Time'] },
  { head: 'Fonts', lines: ['Baloo 2 (Ek Type)', 'Nunito (Vernon Adams and others)', 'Silkscreen (Jason Kottke)'] },
  { head: 'Music and sound', lines: ['Every song and sound is made live in the game: no recordings'] },
  { head: 'Thank you', lines: ['Everyone who fished the beta lake, sent a bug report or wrote in with an idea'] },
];

/** Another map's own credits ({ head, lines }), added before the thank-you. */
export function addCredits(list) { CREDITS.splice(CREDITS.length - 1, 0, ...list); }
