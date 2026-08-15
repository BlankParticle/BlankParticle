import { host, type HostConfig } from "./resource.ts";
import { brew, cask, tap } from "./resources/brew.ts";
import { file, source, template, skills } from "./resources/fs.ts";
import { paru } from "./resources/paru.ts";
import { vitePlus } from "./resources/vite-plus.ts";

export const identity = {
  name: "BlankParticle",
  email: "hello@blankparticle.com",
  sshPublicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHNDqiCnWAUMPjj4Q2Y2EjQrr6vF0etV1FCP3Nrus3ek",
};

const toolchain = vitePlus({
  nodeVersions: ["24", "25", "26"],
  defaultNodeVersion: "26",
  globalPackages: [
    "@earendil-works/pi-coding-agent",
    "@nubjs/nub",
    "@openai/codex",
    "bun",
    "pnpm",
    "porffor",
    "t3@nightly",
    "tsx",
  ],
});

const shell = [
  file({
    "home/zshenv": ".zshenv",
    "home/zshrc": ".zshrc",
    "home/zprofile": ".zprofile",
    "home/atuin.toml": ".config/atuin/config.toml",
  }),
  brew(
    "atuin",
    "bat",
    "btop",
    "eza",
    "less",
    "rsync",
    "starship",
    "zoxide",
    "zsh-autosuggestions",
    "zsh-completions",
    "zsh-patina",
  ),
  paru(
    "atuin",
    "bat",
    "btop",
    "eza",
    "less",
    "rsync",
    "starship",
    "zoxide",
    "zsh",
    "zsh-autosuggestions",
    "zsh-completions",
    "zsh-patina-bin",
  ),
];

const git = [
  file(template("home/gitconfig", identity), ".config/git/config"),
  file("home/gitignore", ".config/git/ignore"),
  file(source`${identity.email} ${identity.sshPublicKey}`, ".config/git/allowed_signers"),
  brew("gh", "git", "git-lfs", "lazygit"),
  paru("git", "git-lfs", "github-cli", "lazygit"),
];

const ssh = [
  file(source`${identity.sshPublicKey} ${identity.email}`, ".ssh/id_ed25519.pub"),
  file(
    source`
      ${identity.sshPublicKey} ${identity.email}
      ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPF+GIrErl9gIe0E4tUE6+mQAQ0afuvoEbowZQ5bn9rd anna@blankparticle.com
    `,
    ".ssh/authorized_keys",
  ),
];

// Shared coding-agent instructions and skills, linked into every agent's
// discovery locations.
const agents = [
  file("agents/AGENTS.md", ".codex/AGENTS.md"),
  file("agents/AGENTS.md", ".claude/CLAUDE.md"),
  skills("agents/skills", [".agents/skills", ".claude/skills", ".pi/agent/skills"]),
];

const shared = [shell, git, ssh, agents, toolchain];

const yoruDotfiles = [
  file(
    source`
      eval "$(/opt/homebrew/bin/brew shellenv)"

      export ANDROID_HOME="$HOME/Library/Android/sdk"
      export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
      export DEVELOPER_DIR="/Applications/Xcode-beta.app/Contents/Developer"

      path=(
        "$ANDROID_HOME/platform-tools"
        "$ANDROID_HOME/cmdline-tools/latest/bin"
        "$JAVA_HOME/bin"
        $path
      )
      export PATH
    `,
    ".zshenv.host",
  ),
  file(
    source`
      Include ~/.orbstack/ssh/config

      Host *
        UseKeychain yes
        AddKeysToAgent yes
        IdentityFile ~/.ssh/id_ed25519.pub
        IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
    `,
    ".ssh/config",
  ),
  file(source`source "$HOME/.orbstack/shell/init.zsh"`, ".zshrc.host"),
  file(
    source`
      [gpg "ssh"]
        program = /Applications/1Password.app/Contents/MacOS/op-ssh-sign
    `,
    ".config/git/config.host",
  ),
];

const yoruTools = brew(
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
);

const yoruApps = [
  tap("aprilnea/tap", "egoist/tap", "nkzw-tech/tap"),
  cask(
    "1password",
    "1password-cli",
    "android-studio",
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
    "orbstack",
    "prismlauncher",
    "raycast",
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
  ),
];

export const hosts: Record<string, HostConfig> = {
  yoru: host("darwin", shared, yoruDotfiles, yoruTools, yoruApps),
  orion: host(
    "linux",
    shared,
    file(
      source`
        Host *
          AddKeysToAgent yes
          IdentityFile ~/.ssh/id_ed25519
      `,
      ".ssh/config",
    ),
  ),
};
