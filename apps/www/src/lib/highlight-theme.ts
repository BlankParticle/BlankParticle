import { createThemeCss } from "@tanstack/highlight/theme";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";

/** Token colours for code blocks, inlined into the document head by the root route; light only, like the rest of the site */
export const highlightThemeCss = createThemeCss({ light: githubLightTheme });
