import * as Namespace from "alchemy/Namespace";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { file, source } from "./content.ts";
import * as Fleet from "./machine/index.ts";

export const Identity = {
  name: "BlankParticle",
  email: "hello@blankparticle.com",
  sshPublicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHNDqiCnWAUMPjj4Q2Y2EjQrr6vF0etV1FCP3Nrus3ek",
};

export const Dotfiles = Effect.gen(function* () {
  const atuin = yield* Fleet.Platform.for({
    darwin: Fleet.Brew.Package("package", { name: "atuin" }),
    linux: Fleet.Paru.Package("package", { name: "atuin" }),
  });
  yield* Fleet.File("config", {
    target: ".config/atuin/config.toml",
    source: yield* source`
      enter_accept = true
      inline_height = 10
      inline_height_shell_up_key_binding = 10
      search_mode = "daemon-fuzzy"

      [daemon]
      enabled = true
      autostart = true
    `,
    dependsOn: atuin,
  });
}).pipe(Namespace.push("atuin"));

export const Zsh = Effect.gen(function* () {
  const setup = yield* Fleet.Platform.for({
    darwin: Effect.gen(function* () {
      const androidStudio = yield* Fleet.Brew.Cask("android-studio", { name: "android-studio" });
      const dependencies = yield* Effect.all(
        [
          "bat",
          "eza",
          "lazygit",
          "starship",
          "zoxide",
          "zsh",
          "zsh-autosuggestions",
          "zsh-completions",
          "zsh-patina",
        ].map((name) => Fleet.Brew.Package(name, { name })),
        { concurrency: "unbounded" },
      );
      return {
        androidStudio,
        dependencies,
        variables: {
          ANDROID_HOME: "$HOME/Library/Android/sdk",
          JAVA_HOME: "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
          DEVELOPER_DIR: "/Applications/Xcode-beta.app/Contents/Developer",
        },
        paths: ["$ANDROID_HOME/platform-tools", "$ANDROID_HOME/cmdline-tools/latest/bin", "$JAVA_HOME/bin"],
        runtime: 'source "$HOME/.orbstack/shell/init.zsh"',
      };
    }),
    linux: Effect.gen(function* () {
      const dependencies = yield* Effect.all(
        [
          "bat",
          "eza",
          "lazygit",
          "starship",
          "zoxide",
          "zsh",
          "zsh-autosuggestions",
          "zsh-completions",
          "zsh-patina-bin",
        ].map((name) => Fleet.Paru.Package(name, { name })),
        { concurrency: "unbounded" },
      );
      return { androidStudio: undefined, dependencies, variables: {}, paths: [], runtime: "" };
    }),
  });

  yield* Effect.all(
    [
      Fleet.Zsh.Environment("environment", {
        dependsOn: setup.androidStudio,
        variables: {
          DO_NOT_TRACK: "1",
          ...setup.variables,
        },
        defaults: { EDITOR: "code --wait" },
        paths: [
          "$HOME/.local/bin",
          "$HOME/.cargo/bin",
          "$HOME/go/bin",
          "$HOME/.opencode/bin",
          "$HOME/.lmstudio/bin",
          ...setup.paths,
        ],
        aliases: {
          "...": { command: "../..", global: true },
          "....": { command: "../../..", global: true },
          ".....": { command: "../../../..", global: true },
          "-": "cd -",
          d: "dirs -v | head -10",
          ls: "eza -a",
          l: "eza -la",
          vsc: "code -r",
          q: "exit",
          cat: "bat",
          c: "clear",
          g: "git",
          lg: "lazygit",
        },
        statements: [
          `
          tmpcd() {
            local directory
            directory="$(mktemp -d)" || return
            cd "$directory" || return
          }

          bp() {
            case "$1" in
              clone)
                if [[ "$2" == "--help" ]]; then
                  print "usage: bp clone <owner/repo|url>"
                  return 0
                fi

                if (( $# != 2 )); then
                  print -u2 "usage: bp clone <owner/repo|url>"
                  return 2
                fi

                local repo_info owner_repo ssh_url destination
                repo_info="$(gh repo view "$2" --json nameWithOwner,sshUrl --jq '.nameWithOwner + "\\t" + .sshUrl')" || return
                owner_repo="\${repo_info%%$'\\t'*}"
                ssh_url="\${repo_info#*$'\\t'}"
                destination="$HOME/Projects/$owner_repo"

                mkdir -p "\${destination:h}" || return
                git clone "$ssh_url" "$destination"
                ;;
              *)
                print -u2 "usage: bp clone <owner/repo|url>"
                return 2
                ;;
            esac
          }
          `,
        ],
      }),
      Fleet.Zsh.Runtime("runtime", {
        dependsOn: setup.dependencies,
        source: yield* source`
          setopt AUTO_CD AUTO_PUSHD PUSHD_IGNORE_DUPS PUSHD_MINUS INTERACTIVE_COMMENTS
          setopt AUTO_MENU COMPLETE_IN_WORD ALWAYS_TO_END NO_FLOW_CONTROL
          setopt EXTENDED_HISTORY HIST_EXPIRE_DUPS_FIRST HIST_IGNORE_DUPS HIST_IGNORE_SPACE
          setopt HIST_VERIFY SHARE_HISTORY

          HISTFILE="$HOME/.zsh_history"
          HISTSIZE=50000
          SAVEHIST=10000

          if [[ -n "$HOMEBREW_PREFIX" ]]; then
            fpath+=("$HOMEBREW_PREFIX/share/zsh-completions" "$HOMEBREW_PREFIX/share/zsh/site-functions")
          fi
          [[ -d "$HOME/.zsh/completions" ]] && fpath+=("$HOME/.zsh/completions")

          autoload -U compinit && compinit

          zstyle ':completion:*' matcher-list 'm:{a-zA-Z-_}={A-Za-z_-}' 'r:|=*' 'l:|=* r:|=*'
          zstyle ':completion:*' menu select
          zstyle ':completion:*' special-dirs true
          zstyle ':completion:*' list-colors "\${(s.:.)LS_COLORS}"
          zstyle ':completion:*' use-cache yes
          zstyle ':completion:*' cache-path "$HOME/.zsh/cache"
          zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#) ([0-9a-z-]#)*=01;34=0=01'

          for _autosuggestions in \
            "\${HOMEBREW_PREFIX:-/dev/null}/share/zsh-autosuggestions/zsh-autosuggestions.zsh" \
            "/usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh"; do
            [[ -f "$_autosuggestions" ]] && source "$_autosuggestions" && break
          done
          unset _autosuggestions
          ZSH_AUTOSUGGEST_STRATEGY=(history completion)
          ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#7a8194,bold,underline"

          eval "$(starship init zsh)"
          eval "$(zoxide init zsh)"
          eval "$(atuin init zsh)"
          eval "$(zsh-patina activate)"

          ${setup.runtime}
        `,
      }),
      Fleet.Zsh.Profile("profile", {
        source: yield* source`
          # macOS path_helper (/etc/zprofile) reshuffles PATH after ~/.zshenv has run,
          # putting system dirs first. Re-source ~/.zshenv so our entries win again;
          # typeset -U path in there keeps PATH deduped. Harmless on Linux.
          source "$HOME/.zshenv"
        `,
      }),
    ],
    { concurrency: "unbounded", discard: true },
  );
}).pipe(Namespace.push("zsh"));

export const Git = Effect.gen(function* () {
  const setup = yield* Fleet.Platform.for({
    darwin: Effect.gen(function* () {
      const dependencies = yield* Effect.all(
        ["git", "git-lfs", "gh", "less"].map((name) => Fleet.Brew.Package(name, { name })),
        { concurrency: "unbounded" },
      );
      const onePassword = yield* Fleet.Brew.Cask("one-password", { name: "1password" });
      return {
        dependencies,
        onePassword,
        signingProgram: "  program = /Applications/1Password.app/Contents/MacOS/op-ssh-sign",
      };
    }),
    linux: Effect.gen(function* () {
      const dependencies = yield* Effect.all(
        ["git", "git-lfs", "github-cli", "less"].map((name) => Fleet.Paru.Package(name, { name })),
        { concurrency: "unbounded" },
      );
      return { dependencies, onePassword: undefined, signingProgram: "" };
    }),
  });
  yield* Fleet.File("config", {
    target: ".config/git/config",
    source: yield* source`
      [user]
        name = ${Identity.name}
        email = ${Identity.email}
        signingkey = ~/.ssh/id_ed25519.pub

      [init]
        defaultBranch = main

      [core]
        pager = less
        excludesFile = ~/.config/git/ignore

      [pull]
        rebase = true

      [rebase]
        autoStash = true

      [rerere]
        enabled = true
        autoUpdate = true

      [push]
        autoSetupRemote = true
        default = current
        recurseSubmodules = on-demand

      [diff]
        submodule = log

      [status]
        submoduleSummary = 1

      [commit]
        gpgsign = true

      [tag]
        gpgsign = true

      [gpg]
        format = ssh

      [gpg "ssh"]
        allowedSignersFile = ~/.config/git/allowed_signers
      ${setup.signingProgram}

      [alias]
        co = checkout

      [filter "lfs"]
        clean = git-lfs clean -- %f
        smudge = git-lfs smudge -- %f
        process = git-lfs filter-process
        required = true

      [credential "https://github.com"]
        helper =
        helper = !gh auth git-credential

      [credential "https://gist.github.com"]
        helper =
        helper = !gh auth git-credential

    `,
    dependsOn: [setup.dependencies, setup.onePassword],
  });
  yield* Fleet.File("ignore", {
    target: ".config/git/ignore",
    source: yield* source`
      .DS_Store
      **/.claude/settings.local.json
    `,
    dependsOn: setup.dependencies,
  });
  yield* Fleet.File("allowed-signers", {
    target: ".config/git/allowed_signers",
    source: yield* source`${Identity.email} ${Identity.sshPublicKey}`,
    dependsOn: setup.dependencies,
  });
}).pipe(Namespace.push("git"));

export const Ssh = Effect.gen(function* () {
  const setup = yield* Fleet.Platform.for({
    darwin: Effect.gen(function* () {
      const orbstack = yield* Fleet.Brew.Cask("orbstack", { name: "orbstack" });
      return {
        orbstack,
        source: yield* source`
          Include ~/.orbstack/ssh/config

          Host *
            UseKeychain yes
            AddKeysToAgent yes
            IdentityFile ~/.ssh/id_ed25519
        `,
      };
    }),
    linux: Effect.gen(function* () {
      return {
        orbstack: undefined,
        source: yield* source`
          Host *
            AddKeysToAgent yes
            IdentityFile ~/.ssh/id_ed25519
        `,
      };
    }),
  });
  yield* Fleet.File("config", {
    target: ".ssh/config",
    dependsOn: setup.orbstack,
    source: setup.source,
    mode: 0o600,
  });
  yield* Fleet.File("public-key", {
    target: ".ssh/id_ed25519.pub",
    source: yield* source`${Identity.sshPublicKey} ${Identity.email}`,
    mode: 0o644,
  });
  yield* Fleet.File("authorized-keys", {
    target: ".ssh/authorized_keys",
    source: yield* source`
      ${Identity.sshPublicKey} ${Identity.email}
      ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPF+GIrErl9gIe0E4tUE6+mQAQ0afuvoEbowZQ5bn9rd anna@blankparticle.com
    `,
    mode: 0o600,
  });
}).pipe(Namespace.push("ssh"));

export const Agents = Effect.gen(function* () {
  const instructions = yield* file("agents/AGENTS.md");
  yield* Effect.all(
    [
      Fleet.Codex.Instructions("instructions", { source: instructions }).pipe(Namespace.push("codex")),
      Fleet.Claude.Instructions("instructions", { source: instructions }).pipe(Namespace.push("claude")),
    ],
    { concurrency: "unbounded", discard: true },
  );

  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillsDirectory = path.resolve(import.meta.dirname, "../agents/skills");
  const skillNames = (yield* fileSystem.exists(skillsDirectory).pipe(Effect.orDie))
    ? yield* fileSystem.readDirectory(skillsDirectory).pipe(Effect.orDie)
    : [];
  for (const name of skillNames) {
    const sourcePath = `agents/skills/${name}/SKILL.md`;
    const skill = yield* file(sourcePath);
    yield* Effect.all(
      [
        Fleet.Codex.Skill(name, { name, source: skill }).pipe(Namespace.push("skills"), Namespace.push("codex")),
        Fleet.Claude.Skill(name, { name, source: skill }).pipe(Namespace.push("skills"), Namespace.push("claude")),
        Fleet.File(name, { target: `.pi/agent/skills/${name}/SKILL.md`, source: skill }).pipe(
          Namespace.push("skills"),
          Namespace.push("pi"),
        ),
      ],
      { concurrency: "unbounded", discard: true },
    );
  }
}).pipe(Namespace.push("agents"));

export const Toolchain = Effect.gen(function* () {
  const vitePlus = yield* Fleet.VitePlus.Toolchain("vite-plus");
  const nodes = yield* Effect.all(
    ["24", "25", "26"].map((version) => Fleet.VitePlus.Node(version, { version })),
    { concurrency: "unbounded" },
  ).pipe(Namespace.push("nodes"), Namespace.push("vite-plus"));
  const node = nodes.at(-1)!;
  yield* Fleet.VitePlus.Default("default", { version: "26" }).pipe(Namespace.push("vite-plus"));
  yield* Effect.all(
    [
      Fleet.Claude.Toolchain("toolchain", {}).pipe(Namespace.push("claude")),
      Fleet.Codex.Toolchain("toolchain", { vitePlus, node }).pipe(Namespace.push("codex")),
      ...["@earendil-works/pi-coding-agent", "@nubjs/nub", "bun@1.3.13", "pnpm", "porffor", "t3@nightly", "tsx"].map(
        (spec) =>
          Fleet.VitePlus.Global(spec, { spec, node: "26" }).pipe(
            Namespace.push("globals"),
            Namespace.push("vite-plus"),
          ),
      ),
    ],
    { concurrency: "unbounded", discard: true },
  );
}).pipe(Namespace.push("toolchain"));
