import { Brand } from "@blankparticle/ui/components/app-shell.tsx";
import { ArrowLeftIcon, PlanetIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Link } from "@tanstack/react-router";

import { LiveTime } from "./live-time.tsx";

/** Slim masthead on every page: a back button when there is somewhere to go back to, the wordmark, and the local time */
export function SiteHeader({ back }: { back?: { to: "/" | "/blog"; label: string } }) {
  return (
    <header className="animate-reveal flex items-center gap-3 border-b py-3.5 motion-reduce:animate-none">
      {back && (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Back to ${back.label}`}
          nativeButton={false}
          render={<Link to={back.to} />}
        >
          <ArrowLeftIcon weight="bold" />
        </Button>
      )}
      <Link to="/" className="rounded-md">
        <Brand icon={<PlanetIcon weight="bold" />} />
      </Link>
      <LiveTime className="ml-auto" />
    </header>
  );
}
