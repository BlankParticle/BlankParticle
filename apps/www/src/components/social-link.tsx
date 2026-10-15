import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { cn } from "@blankparticle/ui/utils";
import type { ReactNode } from "react";

/** The three inks a sticker can be printed in; hover fills the sticker with its own ink */
export const stickerInks = [
  "sticker-primary border-primary text-primary hover:bg-primary hover:text-primary-foreground",
  "sticker-orange-deep border-orange-deep text-orange-deep hover:bg-orange-deep hover:text-primary-foreground",
  "hover:bg-foreground hover:text-background",
] as const;

interface Props {
  name: string;
  ink: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

/** One social destination as a round sticker: links out, or opens a contact dialog */
export function SocialLink({ name, ink, icon, href, onClick }: Props) {
  return (
    <Button
      variant="sticker"
      size="lg"
      // Swap inverted colors immediately: fading both makes the label disappear midway through hover.
      className={cn("gap-2 rounded-full px-4 pl-2.5 transition-[box-shadow,translate]", ink)}
      onClick={onClick}
      nativeButton={!href}
      render={href ? <a href={href} target="_blank" rel="nofollow noopener noreferrer" /> : <button type="button" />}
    >
      {icon}
      {name}
    </Button>
  );
}
