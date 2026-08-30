import { Fragment } from "react";

type MarqueeProps = {
  tickers: string[];
};

/** Full-bleed ticker on a violet band; decorative, so hidden from assistive tech */
export function Marquee({ tickers }: MarqueeProps) {
  return (
    <div
      className="reveal reveal-450 bleed bg-primary/10 border-primary/25 overflow-hidden border-y py-2.5"
      aria-hidden="true"
    >
      <div className="animate-marquee flex w-max motion-reduce:animate-none">
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
  );
}
