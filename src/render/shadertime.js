// The time a shader is sent (Nov 2026). A uniform is a 32-bit float: after a long session the seconds since the game
// started lose their fractions (at a day in, a step is 8 ms), and flames, falls and twinkling stars begin to judder.
// shaderTime() wraps the time every WRAP seconds (about nine hours, the lakes' own wrap: src/world/water.js), so the
// number sent stays small and smooth. Nothing looks different; at the wrap itself an effect skips to another moment of
// its own animation for one frame, once in nine hours of play.
export const WRAP = 32768;
export const shaderTime = (t) => t - Math.floor(t / WRAP) * WRAP;
