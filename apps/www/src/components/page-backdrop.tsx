import { CaretLeftIcon, CaretRightIcon } from "@blankparticle/ui/icons";
import { cn } from "@blankparticle/ui/utils";
import { useEffect, useRef, useState } from "react";

import backdropUrl from "#/assets/backdrop.webp";
import { FRAGMENT_SHADER, TEXTURES, VERTEX_SHADER, type Texture } from "#/lib/textures.ts";

/**
 * Which part of the image stays in frame when it is cropped to cover (0 = left/top edge, 1 = right/bottom).
 * On landscape screens the sun's halo lands above the avatar and the ringed planet sits faintly behind
 * the intro; on portrait screens the soft left-hand sky and shooting stars stay behind the hero.
 */
const FOCUS_LANDSCAPE = [1, 0.3] as const;
const FOCUS_PORTRAIT = [0, 0.3] as const;

/** The image scaled to cover a `width` × `height` area and slid towards the focus; CSS pixels */
function placeImage(width: number, height: number, image: HTMLImageElement) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const focus = width > height ? FOCUS_LANDSCAPE : FOCUS_PORTRAIT;
  return {
    offset: [(width - drawWidth) * focus[0], (height - drawHeight) * focus[1]] as const,
    size: [drawWidth, drawHeight] as const,
  };
}

/** `?texture=<id>` pins one texture (handy for previewing them); otherwise each load rolls a random one */
function pickTexture(): Texture {
  const requested = new URLSearchParams(window.location.search).get("texture");
  const pinned = TEXTURES.find((texture) => texture.id === requested);
  return pinned ?? TEXTURES[Math.floor(Math.random() * TEXTURES.length)]!;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

/** Sets up the program and image; `draw` redraws at the canvas's current size, `setTexture` switches effect and redraws */
function createRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, texture: Texture) {
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // one triangle that covers the viewport
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform("u_effect"), texture.effect);
  gl.uniform1f(uniform("u_seed"), Math.random());

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (width === 0 || height === 0) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniform("u_resolution"), width, height);
    gl.uniform1f(uniform("u_dpr"), width / canvas.clientWidth);
    const placement = placeImage(canvas.clientWidth, canvas.clientHeight, image);
    gl.uniform2f(uniform("u_offset"), ...placement.offset);
    gl.uniform2f(uniform("u_drawSize"), ...placement.size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const setTexture = (next: Texture) => {
    gl.uniform1i(uniform("u_effect"), next.effect);
    draw();
  };
  return { draw, setTexture };
}

/**
 * The galaxy illustration behind the top of every page, run through one of the print and paint
 * textures in `#/lib/textures.ts`, picked at random per load. It redraws only on resize, fades into
 * the paper at the bottom, and stays empty when WebGL is unavailable. Decorative, so hidden from assistive tech.
 */
export function PageBackdrop({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer>>(null);
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let observer: ResizeObserver | undefined;
    let cancelled = false;
    const picked = pickTexture();

    const image = new Image();
    image.decoding = "async";
    image.src = backdropUrl;
    image
      .decode()
      .then(() => {
        if (cancelled) return;
        const renderer = createRenderer(canvas, image, picked);
        if (!renderer) return;
        rendererRef.current = renderer;
        renderer.draw();
        observer = new ResizeObserver(renderer.draw);
        observer.observe(canvas);
        setTexture(picked);
      })
      // no backdrop is fine; say why in development
      .catch((error: unknown) => import.meta.env.DEV && console.error("page backdrop:", error));

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  const switchTexture = (next: Texture) => {
    rendererRef.current?.setTexture(next);
    setTexture(next);
  };

  return (
    <>
      <div
        className={cn("pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden select-none", className)}
        data-texture={texture?.id}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          className={cn("size-full transition-opacity duration-1000 ease-out", texture ? "opacity-100" : "opacity-0")}
        />
        {/* fade into the paper at both ends: the top hides the image's blue upper sky under the masthead, the
            bottom clears the content below; an overlay rather than a mask, which can blank WebGL canvases */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_32%,transparent_40%,var(--color-background)_100%)]" />
      </div>
      {import.meta.env.DEV && texture && <TextureSwitcher texture={texture} onChange={switchTexture} />}
    </>
  );
}

/**
 * Development only: step through the textures to judge them on the real page. It sits on the image's
 * top-right corner, just under the masthead, and scrolls with it. `[` and `]` work too, and the URL
 * keeps `?texture=` in sync so a reload stays put.
 */
function TextureSwitcher({ texture, onChange }: { texture: Texture; onChange: (next: Texture) => void }) {
  const index = TEXTURES.indexOf(texture);
  const step = (by: number) => {
    const next = TEXTURES[(index + by + TEXTURES.length) % TEXTURES.length]!;
    const url = new URL(window.location.href);
    url.searchParams.set("texture", next.id);
    window.history.replaceState(window.history.state, "", url);
    onChange(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "[") step(-1);
      if (event.key === "]") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const arrowClass =
    "text-foreground/55 hover:text-foreground grid size-6 cursor-pointer place-items-center transition-colors";
  return (
    <div className="text-foreground/80 absolute top-20 right-3 z-30 flex items-center text-xs sm:right-5">
      <button
        type="button"
        className={arrowClass}
        onClick={() => step(-1)}
        aria-label="Previous texture"
        title="Previous ([)"
      >
        <CaretLeftIcon weight="bold" />
      </button>
      <span className="min-w-28 text-center font-semibold" aria-live="polite">
        {texture.name}
        <span className="ml-1.5 font-normal tabular-nums opacity-60">
          {index + 1}/{TEXTURES.length}
        </span>
      </span>
      <button type="button" className={arrowClass} onClick={() => step(1)} aria-label="Next texture" title="Next (])">
        <CaretRightIcon weight="bold" />
      </button>
    </div>
  );
}
