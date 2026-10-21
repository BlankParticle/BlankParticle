/** Build-time constants from `define` in vite.config.ts */
interface ImportMetaEnv {
  /** short hash of the deployed commit, or "development" */
  readonly VITE_GIT_HASH: string;
  /** code-block token colours, generated from the @tanstack/highlight theme */
  readonly HIGHLIGHT_THEME_CSS: string;
}
