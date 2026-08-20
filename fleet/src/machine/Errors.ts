import * as Data from "effect/Data";
import type * as PlatformError from "effect/PlatformError";

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: readonly string[];
  readonly exitCode: number;
  readonly output: string;
}> {
  override get message() {
    return `${this.command.join(" ")} (exit ${this.exitCode}):\n${this.output.slice(-2_000)}`;
  }
}

export class UnsupportedPlatformError extends Data.TaggedError("UnsupportedPlatformError")<{
  readonly provider: string;
  readonly expected: string;
  readonly actual: string;
}> {
  override get message() {
    return `${this.provider} requires ${this.expected}, but the target is ${this.actual}`;
  }
}

export class ToolNotFoundError extends Data.TaggedError("ToolNotFoundError")<{
  readonly tool: string;
  readonly hint?: string;
}> {
  override get message() {
    return `${this.tool} was not found${this.hint ? ` — ${this.hint}` : ""}`;
  }
}

export class HomeDirectoryError extends Data.TaggedError("HomeDirectoryError")<{
  readonly host: string;
}> {
  override get message() {
    return `could not resolve HOME on ${this.host}`;
  }
}

export class ManifestSourceError extends Data.TaggedError("ManifestSourceError")<{
  readonly source: string;
}> {
  override get message() {
    return `manifest source missing: ${this.source}`;
  }
}

export class VersionResolutionError extends Data.TaggedError("VersionResolutionError")<{
  readonly tool: string;
  readonly spec: string;
}> {
  override get message() {
    return `${this.tool} could not resolve ${this.spec}`;
  }
}

export class SudoUnavailableError extends Data.TaggedError("SudoUnavailableError")<{
  readonly userId: number;
}> {
  override get message() {
    return `sudo is required for user ${this.userId}, but it is not installed`;
  }
}

export class SudoAuthenticationError extends Data.TaggedError("SudoAuthenticationError") {
  override get message() {
    return "sudo authentication failed";
  }
}

export type CommandFailure = CommandError | PlatformError.PlatformError;
export type FileSystemFailure = CommandFailure | HomeDirectoryError;
