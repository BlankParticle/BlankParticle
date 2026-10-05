/**
 * Print and paint textures for the page backdrop, after the filters on texture.fayaz.workers.dev.
 * Our own implementations: one fragment shader, picked by `u_effect`, drawn once per resize.
 * All lengths are in CSS pixels; `fill()` antialiases a signed distance over one device pixel.
 */

/**
 * The textures in the random rotation. `effect` is the branch number in the shader's `main()`, so
 * deleting a line here only drops that texture from the rotation; the others keep their effects.
 * `id` is what `?texture=` accepts.
 */
export const TEXTURES = [
  { id: "glyphfield", name: "Glyphfield", effect: 0 },
  { id: "typeblocks", name: "Typeblocks", effect: 1 },
  { id: "stipple", name: "Stipple", effect: 2 },
  { id: "paper", name: "Paper", effect: 3 },
  { id: "watercolor", name: "Watercolor", effect: 4 },
  { id: "cyanotype", name: "Cyanotype", effect: 5 },
  { id: "signal-mix", name: "Signal Mix", effect: 6 },
  { id: "tessera", name: "Tessera", effect: 7 },
  { id: "crossmarks", name: "Crossmarks", effect: 8 },
  { id: "facets", name: "Facets", effect: 9 },
  { id: "linepress", name: "Linepress", effect: 10 },
  { id: "slant", name: "Slant", effect: 11 },
  { id: "dot-cells", name: "Dot Cells", effect: 12 },
  { id: "isoform", name: "Isoform", effect: 13 },
  { id: "chroma-pop", name: "Chroma Pop", effect: 14 },
] as const;

export type Texture = (typeof TEXTURES)[number];

export const VERTEX_SHADER = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform vec2 u_drawSize;
uniform float u_dpr;
uniform float u_seed;
uniform int u_effect;

/* ---------- helpers ---------- */

// the image as placed by the page (top-left corner and drawn size); px is in CSS pixels from the top left
vec3 img(vec2 px) {
  return texture2D(u_image, clamp((px - u_offset) / u_drawSize, 0.0, 1.0)).rgb;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 saturate(vec3 c, float k) { return clamp(mix(vec3(luma(c)), c, k), 0.0, 1.0); }

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + u_seed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

float fill(float d) { return clamp(0.5 - d * u_dpr, 0.0, 1.0); }
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// a grid cell: its index, the offset from its centre, and the image at its centre
vec2 cellId(vec2 px, vec2 size) { return floor(px / size); }
vec2 cellOffset(vec2 px, vec2 size) { return px - (floor(px / size) + 0.5) * size; }
vec3 cellColor(vec2 px, vec2 size) { return img((floor(px / size) + 0.5) * size); }

vec3 blur(vec2 px, float radius) {
  vec3 sum = img(px);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996;
    float r = radius * sqrt((float(i) + 0.5) / 12.0);
    sum += img(px + vec2(cos(a), sin(a)) * r);
  }
  return sum / 13.0;
}

vec3 grainy(vec3 c, vec2 px, float amount) { return c + (hash(floor(px)) - 0.5) * amount; }

/* ---------- effects ---------- */

// small characters whose weight follows the shade: . - + *
vec3 glyphfield(vec2 px) {
  vec2 size = vec2(7.0, 11.0);
  vec2 f = cellOffset(px, size);
  vec3 cc = cellColor(px, size);
  float level = floor(clamp((1.0 - luma(cc)) * 1.5, 0.0, 0.999) * 5.0);
  float d = 99.0;
  vec2 dash = vec2(2.5, 0.5);
  if (level == 1.0) d = length(f - vec2(0.0, 3.0)) - 1.0;
  else if (level == 2.0) d = box(f, dash);
  else if (level == 3.0) d = min(box(f, dash), box(f, dash.yx));
  else if (level == 4.0) d = min(min(box(f, dash), box(f, dash.yx)), min(segment(f, vec2(-2.0), vec2(2.0)), segment(f, vec2(-2.0, 2.0), vec2(2.0, -2.0))) - 0.5);
  return mix(img(px), cc * 0.62, fill(d) * 0.55);
}

// block characters that fill from the bottom: ▁ ▂ ▃ ▄ ▅ ▆ ▇ █
vec3 typeblocks(vec2 px) {
  vec2 size = vec2(7.0, 11.0);
  vec2 f = cellOffset(px, size);
  vec3 cc = cellColor(px, size);
  float h = floor(clamp((1.0 - luma(cc)) * 1.4, 0.0, 1.0) * 8.0) / 8.0 * 9.0;
  float d = box(f - vec2(0.0, 4.5 - h * 0.5), vec2(2.6, h * 0.5));
  return mix(img(px), cc * 0.6, fill(d) * step(0.1, h) * 0.32);
}

// a grey wash with light stippled dots
vec3 stipple(vec2 px) {
  vec2 size = vec2(5.0);
  vec3 base = mix(img(px), vec3(0.74), 0.4);
  float r = 0.4 + 1.2 * luma(cellColor(px, size));
  return mix(base, vec3(1.0), fill(length(cellOffset(px, size)) - r) * 0.55);
}

// washed out onto fibrous paper
vec3 paperTexture(vec2 px) {
  vec3 c = mix(img(px), vec3(0.975, 0.96, 0.93), 0.35);
  float fibres = fbm(px * vec2(0.35, 0.9)) * 0.07 + (noise(px * vec2(0.08, 1.4)) - 0.5) * 0.03;
  return grainy(c + fibres - 0.035, px, 0.035);
}

// soft blur, pigment pooling at the edges, bleached highlights and granulation
vec3 watercolor(vec2 px) {
  vec3 sharp = img(px);
  vec3 soft = blur(px + (vec2(noise(px * 0.05), noise(px * 0.05 + 7.0)) - 0.5) * 6.0, 4.0);
  float pooling = length(sharp - soft) * 3.0;
  vec3 c = mix(saturate(mix(soft, sharp, 0.3), 1.3), vec3(1.0), 0.16);
  c *= 1.0 - pooling * 0.22;
  c *= 0.95 + 0.07 * fbm(px * 0.06);
  return grainy(c, px, 0.02);
}

// prussian blue sun print on cream
vec3 cyanotype(vec2 px) {
  float l = smoothstep(0.05, 0.95, luma(img(px)));
  vec3 col = mix(vec3(0.12, 0.36, 0.47), vec3(0.925, 0.918, 0.835), pow(l, 0.8));
  col += fbm(px * 0.6) * 0.08 - 0.04;
  return grainy(col * (0.97 + 0.03 * noise(px * 0.05)), px, 0.03);
}

// a mix of dots, dashes, slashes and pluses
vec3 signalMix(vec2 px) {
  vec2 size = vec2(8.0);
  vec2 f = cellOffset(px, size);
  vec3 cc = cellColor(px, size);
  float len = 1.0 + 2.5 * (1.0 - luma(cc));
  float pick = hash(cellId(px, size));
  float d;
  if (pick < 0.25) d = length(f) - len * 0.45;
  else if (pick < 0.5) d = box(f, vec2(len, 0.5));
  else if (pick < 0.75) d = segment(f, vec2(-len, len), vec2(len, -len)) - 0.5;
  else d = min(box(f, vec2(len, 0.5)), box(f, vec2(0.5, len)));
  return mix(img(px), cc * 0.6, fill(d) * 0.4);
}

// mosaic tiles with pale grout
vec3 tessera(vec2 px) {
  vec2 size = vec2(9.0);
  vec2 f = px - cellId(px, size) * size;
  float grout = max(step(size.x - 1.0, f.x), step(size.y - 1.0, f.y));
  vec3 tile = cellColor(px, size) * (0.97 + 0.06 * hash(cellId(px, size)));
  return mix(tile, vec3(1.0), grout * 0.6);
}

// small plus marks whose size follows the shade
vec3 crossmarks(vec2 px) {
  vec2 size = vec2(12.0);
  vec2 f = cellOffset(px, size);
  vec3 cc = cellColor(px, size);
  float len = 1.0 + 3.5 * (1.0 - luma(cc));
  float d = min(box(f, vec2(len, 0.5)), box(f, vec2(0.5, len)));
  return mix(img(px), cc * 0.6, fill(d) * 0.5);
}

// a diamond lattice of flat, lightly shaded facets
vec3 facets(vec2 px) {
  float size = 10.0;
  vec2 q = vec2(px.x + px.y, px.y - px.x) * 0.70710678;
  vec2 id = floor(q / size);
  vec2 f = q - (id + 0.5) * size;
  vec2 c = (id + 0.5) * size;
  vec3 col = mix(img(px), img(vec2(c.x - c.y, c.x + c.y) * 0.70710678), 0.6);
  col *= 0.97 + 0.06 * step(0.0, f.x + f.y);
  float edge = 1.0 - fill(size * 0.5 - max(abs(f.x), abs(f.y)) - 0.5);
  return mix(col, vec3(1.0), edge * 0.3);
}

// short horizontal rules, longer in the shadows
vec3 linepress(vec2 px) {
  vec2 size = vec2(10.0, 6.0);
  vec2 f = px - cellId(px, size) * size;
  vec3 cc = cellColor(px, size);
  float len = 9.0 * clamp((1.0 - luma(cc)) * 1.3, 0.0, 1.0);
  float d = box(f - vec2(len * 0.5, 3.0), vec2(len * 0.5, 0.55));
  return mix(img(px), cc * 0.6, fill(d) * step(0.5, len) * 0.45);
}

// diagonal slashes, longer in the shadows
vec3 slant(vec2 px) {
  vec2 size = vec2(7.0);
  vec2 f = cellOffset(px, size);
  vec3 cc = cellColor(px, size);
  float len = 0.5 + 2.5 * (1.0 - luma(cc));
  return mix(img(px), cc * 0.6, fill(segment(f, vec2(-len, len), vec2(len, -len)) - 0.5) * 0.45);
}

// braille cells: up to six dots, more of them in the shadows
vec3 dotCells(vec2 px) {
  vec2 size = vec2(8.0, 12.0);
  vec2 f = px - cellId(px, size) * size;
  vec3 cc = cellColor(px, size);
  vec2 slot = floor(f / 4.0);
  vec2 o = f - (slot + 0.5) * 4.0;
  float on = step((slot.x + slot.y * 2.0 + 0.5) / 6.0, (1.0 - luma(cc)) * 1.25) * step(slot.y, 2.0) * step(slot.x, 1.0);
  return mix(img(px), cc * 0.55, fill(length(o) - 1.1) * on * 0.6);
}

// isometric cubes, each coloured by the image and shaded per face
vec3 isoform(vec2 px) {
  float size = 9.0;
  vec2 p = px / size;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 a = mod(p, r) - r * 0.5;
  vec2 b = mod(p - r * 0.5, r) - r * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec3 col = mix(img((p - g) * size), vec3(0.8), 0.25);
  float angle = degrees(atan(-g.y, g.x));
  if (angle < 0.0) angle += 360.0;
  if (angle > 30.0 && angle < 150.0) col *= 1.08;
  else if (angle >= 150.0 && angle < 270.0) col *= 0.93;
  else col *= 0.82;
  return clamp(col, 0.0, 1.0);
}

// saturated dots over the image, bigger in the shadows
vec3 chromaPop(vec2 px) {
  vec2 size = vec2(9.0);
  vec3 cc = cellColor(px, size);
  float r = size.x * 0.5 * sqrt(clamp((1.0 - luma(cc)) * 1.3 + 0.15, 0.0, 1.0));
  return mix(img(px), saturate(cc, 1.9) * 0.8, fill(length(cellOffset(px, size)) - r) * 0.55);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;
  vec3 c;
  if (u_effect == 0) c = glyphfield(px);
  else if (u_effect == 1) c = typeblocks(px);
  else if (u_effect == 2) c = stipple(px);
  else if (u_effect == 3) c = paperTexture(px);
  else if (u_effect == 4) c = watercolor(px);
  else if (u_effect == 5) c = cyanotype(px);
  else if (u_effect == 6) c = signalMix(px);
  else if (u_effect == 7) c = tessera(px);
  else if (u_effect == 8) c = crossmarks(px);
  else if (u_effect == 9) c = facets(px);
  else if (u_effect == 10) c = linepress(px);
  else if (u_effect == 11) c = slant(px);
  else if (u_effect == 12) c = dotCells(px);
  else if (u_effect == 13) c = isoform(px);
  else c = chromaPop(px);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
