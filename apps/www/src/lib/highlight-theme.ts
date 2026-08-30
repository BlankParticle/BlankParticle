import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";

/** Token colours for code blocks, inlined into the document head by the root route */
export const highlightThemeCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  darkSelector: ".dark",
});
