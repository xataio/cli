<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://xata.io/images/xata-brand-assets/logo-wordmark/logo-wordmark-dark-mode.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://xata.io/images/xata-brand-assets/logo-wordmark/logo-wordmark-light-mode.svg">
    <img width="400" alt="Xata" src="https://xata.io/images/xata-brand-assets/logo-wordmark/logo-wordmark-dark-mode.svg">
  </picture>
</p>

## Xata CLI

The official command-line interface for [Xata](https://xata.io).

### Installation

```bash
# macOS / Linux
curl -fsSL https://xata.io/install.sh | bash

# Windows PowerShell
powershell -c "irm https://xata.io/install.ps1 | iex"
```

After installation, run `xata upgrade` to update to the latest CLI release.

### Agent skills

Discover and install skills from [xataio/skills](https://github.com/xataio/skills), without a Xata login or additional tools:

```bash
xata skill list
xata skill install
xata skill install using-xata-cli
xata skill install using-xata-cli --agent claude-code --agent codex
xata skill install using-xata-cli --agent amp --global
```

`skills` is an alias for `skill`. In an interactive terminal, an install without a name opens a searchable skill selector, then prompts for agents with detected agents preselected. A supplied name skips the skill selector; `--agent` skips agent selection. `xata skill list` always lists available skills without installing. Noninteractive and JSON invocations without a name also only list skills; named installations require `--agent`, which can be repeated to select several agents.

The agent picker is searchable too: type to filter, press Space to toggle a selection, and Enter to confirm. Selected agents remain selected when filtered out.

Project installations use the current directory, or the existing project root passed with `--directory`. Use `--global` for user-wide installation instead; these options cannot be combined.

| Agent | Project directory | User directory |
| --- | --- | --- |
| Claude Code | `.claude/skills` | `~/.claude/skills` (honors `CLAUDE_CONFIG_DIR`) |
| Codex | `.agents/skills` | `~/.agents/skills` |
| Cursor | `.agents/skills` | `~/.cursor/skills` |
| Amp | `.agents/skills` | `~/.config/agents/skills` (honors `XDG_CONFIG_HOME`) |
| GitHub Copilot / VS Code (`github-copilot`) | `.agents/skills` | `~/.copilot/skills` |
| Antigravity CLI (`antigravity-cli`) | `.agents/skills` | `~/.gemini/antigravity-cli/skills` |
| OpenCode (`opencode`) | `.agents/skills` | `~/.config/opencode/skills` (honors `XDG_CONFIG_HOME`) |
| Windsurf (`windsurf`) | `.windsurf/skills` | `~/.codeium/windsurf/skills` |
| Zed (`zed`) | `.agents/skills` | `~/.agents/skills` |
| Cline (`cline`) | `.cline/skills` | `~/.cline/skills` |

These targets cover the local skill-capable harnesses in the [MCP setup guide](https://xata.io/docs/platform/mcp). Claude web/desktop and ChatGPT use their own skill import or connector flows rather than this filesystem installer. Zed installs target the native Zed Agent; for an external agent running inside Zed, select that agent instead.

The command prints exact destinations and copies each complete skill directory once per distinct destination. Copies can be edited independently; other agents may also discover skills in shared directories. Each copy includes `.xata-skill.json` recording its source commit. Reload or restart your agent after installation.

Identical installations are left unchanged. Differing installations, including local edits and extra files, require confirmation or `--force`. Review local changes before replacing them. Destination symlinks are refused, even with `--force`. Installation does not configure the registry's MCP server or plugins, or migrate skills installed by the older `xata ai download claude-skill` command.

### Documentation

See the [Xata documentation](https://xata.io/docs/cli) for usage instructions.

### License

Apache-2.0 — see [LICENSE](LICENSE) for details.
