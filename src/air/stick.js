// Skye's Air Races (v1.17.1): mouse flying, the mouse as a joystick.
/** The mouse as a joystick: a small dead zone in the middle, full deflection about two thirds of the way out. */
export function stickOf(m, dead = 0.07, full = 0.62) {
  const L = Math.hypot(m.x, m.y); if (L < dead) return { x: 0, y: 0 };
  const k = Math.min(1, (L - dead) / (full - dead)) / L; return { x: Math.max(-1, Math.min(1, m.x * k)), y: Math.max(-1, Math.min(1, m.y * k)) };
}
