import { cn } from "cnfast";
import type { ReactNode } from "react";

import { Button } from "./ui/button.tsx";

interface Props {
  name: string;
  tilt: string;
  ink: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function SocialSticker({ name, tilt, ink, icon, href, onClick }: Props) {
  return (
    <Button
      variant="sticker"
      className={cn(tilt, ink)}
      onClick={onClick}
      nativeButton={!href}
      render={href ? <a href={href} target="_blank" rel="noopener noreferrer" /> : <button type="button" />}
    >
      {icon} {name}
    </Button>
  );
}
