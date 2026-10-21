/**
 * The textures in the random rotation. `effect` is the branch number in the shader's `main()` (`backdrop.ts`), so
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
