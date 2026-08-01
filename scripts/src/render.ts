import { join } from "node:path";

import * as Banner from "./components/banner.tsx";
import * as OgImage from "./components/og.tsx";
import { REPO_ROOT } from "./helpers.ts";

await Banner.render(join(REPO_ROOT, ".github/assets/banner.png"), { format: "png" });
await OgImage.render(join(REPO_ROOT, "apps/www/public/og-image.webp"), { format: "webp" });
