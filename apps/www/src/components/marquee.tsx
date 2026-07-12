import { Fragment } from "react";

type MarqueeProps = {
  tickers: string[];
};

export function Marquee({ tickers }: MarqueeProps) {
  return (
    <div
      className="animate-reveal border-ink bg-violet mx-[calc(50%-50vw)] overflow-hidden border-y-2 py-2 [animation-delay:450ms] motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="animate-marquee flex w-max motion-reduce:animate-none">
        {[0, 1, 2, 3, 4, 5].map((_) => (
          <span
            key={_}
            className="text-paper flex shrink-0 items-center text-sm font-extrabold tracking-[0.2em] whitespace-nowrap uppercase"
          >
            {tickers.map((ticker) => (
              <Fragment key={ticker}>
                <span className="px-3">{ticker}</span>
                <span>★</span>
              </Fragment>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
