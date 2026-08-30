import { cn } from "@blankparticle/ui/utils";
import { useEffect, useState } from "react";

const formatter = Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  timeStyle: "medium",
  hourCycle: "h23",
});

/** My local time as a small pill. Renders nothing on the server and fades in once the clock is running, so there is no placeholder */
export function LiveTime({ className }: { className?: string }) {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const interval = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (date === null) return null;

  return (
    <span
      className={cn(
        "rule-dots text-muted-foreground animate-in fade-in inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums duration-300",
        className,
      )}
      title="My local time"
    >
      {formatter.format(date)} IST
    </span>
  );
}
