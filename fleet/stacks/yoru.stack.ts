import { StageInvariant } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Namespace from "alchemy/Namespace";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Fleet from "../src/machine/index.ts";
import { Agents, Dotfiles, Git, Ssh, Toolchain, Zsh } from "../src/shared.ts";

export default Alchemy.Stack(
  "fleet-yoru",
  {
    providers: Fleet.Providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    yield* StageInvariant(Schema.Literal("prod")).pipe(Effect.orDie);

    yield* Dotfiles;
    yield* Zsh;
    yield* Git;
    yield* Ssh;
    yield* Agents;
    yield* Toolchain;

    yield* Fleet.Brew.Toolchain("homebrew");

    yield* Effect.all(
      [
        "ast-grep",
        "awscli",
        "btop",
        "rsync",
        "act",
        "apktool",
        "chafa",
        "cloudflared",
        "cmake",
        "coreutils",
        "doppler",
        "fastfetch",
        "fish",
        "flyctl",
        "fzf",
        "gcc",
        "ghidra",
        "gnupg",
        "go",
        "hashcat",
        "hidapi",
        "innoextract",
        "jadx",
        "just",
        "kondo",
        "libpcap",
        "micropython",
        "mint",
        "mole",
        "mosquitto",
        "mpremote",
        "mtr",
        "neovim",
        "ninja",
        "nmap",
        "nss",
        "openssl@3",
        "opus-tools",
        "pinentry-mac",
        "pkgconf",
        "poppler",
        "qemu",
        "quilt",
        "rclone",
        "readline",
        "ripgrep",
        "scrcpy",
        "stripe-cli",
        "telnet",
        "tmux",
        "tokei",
        "uv",
        "wget",
        "zig",
      ].map((name) => Fleet.Brew.Package(name, { name })),
      { concurrency: "unbounded", discard: true },
    ).pipe(Namespace.push("packages"));
    yield* Effect.all(
      ["aprilnea/tap", "egoist/tap", "nkzw-tech/tap"].map((name) => Fleet.Brew.Tap(name, { name })),
      { concurrency: "unbounded", discard: true },
    ).pipe(Namespace.push("taps"));
    yield* Effect.all(
      [
        "1password-cli",
        "beekeeper-studio",
        "chatgpt",
        "cursor",
        "egoist/tap/kero",
        "ghostty",
        "helium-browser",
        "karabiner-elements",
        "lm-studio",
        "localsend",
        "notunes",
        "opencode-desktop",
        "openusage",
        "prismlauncher",
        "rustdesk",
        "slack",
        "stats",
        "t3-code@nightly",
        "tailscale-app",
        "transmission",
        "vesktop",
        "vlc",
        "whatsapp",
        "yaak",
      ].map((name) => Fleet.Brew.Cask(name, { name })),
      { concurrency: "unbounded", discard: true },
    ).pipe(Namespace.push("apps"));
  }),
);
