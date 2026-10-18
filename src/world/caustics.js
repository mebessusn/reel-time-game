// Animated light caustics on anything below the water line (lake bed, underwater cliffs, dock posts).
// Shared uniforms so the water update drives every patched material at once.

export const CAUSTICS = {
  uCTime: { value: 0 },
  uCaustic: { value: 1 }, // 0..1, follows daylight and rain
  uWaterY: { value: 0.85 }, // set by water.js
};

const GLSL = /* glsl */ `
  uniform float uCTime; uniform float uCaustic; uniform float uWaterY;
  varying vec3 vCW;
  // Pixel-quantized "tileable water caustic" (after Dave Hoskins / joltz0r).
  float causticAt(vec2 p, float t) {
    vec2 q = mod(p * 0.9, 6.2831853) - 250.0;
    vec2 i = q; float c = 1.0; const float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }
`;

export function applyCaustics(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, CAUSTICS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <opaque_fragment>', /* glsl */ `
        {
          float uw = clamp((uWaterY - vCW.y) * 2.0, 0.0, 1.0);
          if (uw > 0.0 && uCaustic > 0.02) {
            float under = uWaterY - vCW.y;
            float fade = uw * exp(-under * 0.22) * uCaustic;
            float c = causticAt(vCW.xz, uCTime * 0.55);
            float c2 = causticAt(vCW.xz * 1.37 + 3.1, uCTime * 0.43 + 1.7);
            outgoingLight += (diffuseColor.rgb * 0.7 + vec3(0.18, 0.22, 0.22)) * smoothstep(0.25, 0.85, c * 0.8 + c2 * 0.45) * fade * 1.6;
            outgoingLight *= mix(vec3(1.0), vec3(0.72, 0.9, 1.0), uw * clamp(under * 0.25, 0.0, 1.0));
          }
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'caustics';
  return material;
}
