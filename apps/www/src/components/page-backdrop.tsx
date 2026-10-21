import { CaretLeftIcon, CaretRightIcon } from "@blankparticle/ui/icons";
import { cn } from "@blankparticle/ui/utils";
import { useEffect, useRef, useState } from "react";

import type { Renderer } from "#/lib/backdrop.ts";
import { TEXTURES, type Texture } from "#/lib/textures.ts";

// the shaders and the image load after hydration, so they stay out of the entry chunk; at module
// level because React Compiler skips components that contain an `import()`
const loadBackdrop = () => import("#/lib/backdrop.ts");

/**
 * The galaxy illustration behind the top of every page, run through one of the print and paint
 * textures in `#/lib/backdrop.ts`, picked at random per load. It redraws only on resize, fades into
 * the paper at the bottom, and stays empty when WebGL is unavailable. Decorative, so hidden from assistive tech.
 */
export function PageBackdrop({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer>(null);
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let observer: ResizeObserver | undefined;
    let cancelled = false;

    loadBackdrop()
      .then(async ({ backdropUrl, createRenderer, pickTexture }) => {
        const picked = pickTexture();
        const image = new Image();
        image.decoding = "async";
        image.src = backdropUrl;
        await image.decode();
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
