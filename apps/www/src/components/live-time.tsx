import { useEffect, useState } from "react";

const formatter = Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  timeStyle: "medium",
  hourCycle: "h23",
});

export default function LiveTime() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const interval = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="tabular-nums">{date ? formatter.format(date) : "--:--:--"}</span>;
}
