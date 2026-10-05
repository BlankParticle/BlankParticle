import { Fragment } from "react";

type MarqueeProps = {
  tickers: string[];
};

/** Full-bleed ticker on a violet band that fades out at the edges and pauses under the cursor; decorative, so hidden from assistive tech */
export function Marquee({ tickers }: MarqueeProps) {
  return (
    <div
      className="group/marquee reveal reveal-450 bleed bg-background/80 from-primary/10 to-primary/10 border-primary/25 overflow-hidden border-y bg-linear-to-r py-2.5"
      aria-hidden="true"
    >
      <div className="mask-x-from-90% mask-x-to-100%">
        <div className="animate-marquee flex w-max group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1, 2, 3, 4, 5].map((_) => (
            <span key={_} className="eyebrow text-primary flex shrink-0 items-center whitespace-nowrap">
              {tickers.map((ticker) => (
                <Fragment key={ticker}>
                  <span className="px-4">{ticker}</span>
                  <span className="text-orange-deep text-2xs">★</span>
                </Fragment>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
