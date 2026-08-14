# 🍻 BrewBoxes

> A lightweight, blazingly fast container launcher that replaces VMs for desktop use. Launch a fully-configured Linux GUI environment in **5-15 minutes** instead of the traditional 2-3 hours.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-24292e?logo=tauri)](https://tauri.app)
[![Rust + TypeScript](https://img.shields.io/badge/Stack-Rust%20%2B%20TypeScript-ce3262?logo=rust)](src-tauri)

**📹 [Watch the Demo Video](https://dl.dropbox.com/scl/fi/jj3ncr01vbetq12mzeded/allBrew.mp4?rlkey=qrcswsnxpblpo463rr7bpx7k4&st=bylsb3z4&dl=0)** – See BrewBoxes in action!

## Origin Story

BrewBoxes was born out of necessity during my school years. Every time I'd install a new VM with my projects, someone would inevitably delete the `D:\` folder or empty the `C:\` drive, wiping away weeks of work. The traditional cycle of downloading an ISO image over school WiFi and waiting 2-3 hours for installation and configuration was unsustainable.

The solution? Container-based environments with pre-built GUI setups. Today, I can spawn a fully functional Linux desktop in minutes—complete with whatever distro and GUI I choose. BrewBoxes automates this entire process and handles both public and private containers for maximum flexibility and privacy.

## What is BrewBoxes?

BrewBoxes is a lightweight desktop application that makes it effortless to launch containerized Linux environments with graphical interfaces. Instead of wrestling with virtual machines, you get:

- **Instant Setup**: Prebuilt Linux container images with GUI environments ready to go
- **Rapid Deployment**: 5-15 minute launch time (vs. 2-3 hours for traditional VMs)
- **Flexible DEs & Distros**: Mix and match your preferred GUI (XFCE, KDE, Cinnamon, etc.) with any Linux distro
- **Public & Private**: Use prebuilt public containers or create private, persistent environments
- **Cross-Platform**: Works on Windows (with WSL2 / native engine), macOS, and Linux
- **Node.js Integration**: Built-in terminal streaming via `node-pty` for real-time installation feedback

## Key Features

### 🚀 Fast Container Provisioning
- Automatic image detection and pull from trusted registries
- Intelligent local caching to skip redundant downloads
- Real-time progress streaming during container startup

### 🔐 Private Containers
- Create persistent, password-protected environments
- Auto-resume existing sessions—pick up where you left off
- Local metadata storage for private container tracking

### 🌐 Multi-Engine Support
- **Podman** (preferred for security)
- **Docker** (widely available)
- **Native Engine** (Windows-only: lightweight Alpine + Nerdctl in WSL2)

### 💻 GUI Terminal Integration
- Terminal streams through `node-pty` for live installation progress
- Support for rich ANSI colors and animations
- Works seamlessly across Windows (PTY/piped modes) and Linux

### 🛡️ Privacy First
- Run public containers anonymously, or
- Spin up isolated private environments with custom credentials
- No telemetry—everything runs locally

## Getting Started

### Quick Install

**Choose your platform:**
- **[Windows](INSTALL.md#windows)** - Native installer or WSL2 Native Engine
- **[macOS](INSTALL.md#macos)** - DMG installer (Intel & Apple Silicon)
- **[Linux](INSTALL.md#linux)** - AppImage or Debian package

**Detailed instructions:** See [INSTALL.md](INSTALL.md)

### First Launch

```
1. Select your preferred Linux distro (Ubuntu, Fedora, Alpine, Arch, etc.)
2. Choose your GUI desktop environment (XFCE, KDE, Cinnamon, MATE, etc.)
3. [Optional] Set a username and password for a private session
4. Click "Launch" and watch the terminal stream the setup process
5. Access your desktop via the embedded browser window
```

### Native Engine (Windows Only)

For the best Windows experience, BrewBoxes can set up a lightweight **Native Engine**:

- Minimal Alpine Linux + Nerdctl inside WSL2
- No Docker Desktop dependency
- Faster container operations

**To set up:**
1. Open BrewBoxes Settings
2. Click "Setup Native Engine"
3. Let it download and configure automatically (~5-10 minutes one-time)

## Architecture

```
┌─────────────────────────────────────────────┐
│        BrewBoxes Desktop App (Tauri)        │
│  ┌─────────────────────────────────────┐    │
│  │   TypeScript/React Frontend (UI)    │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │   Rust Backend (Container Logic)    │    │
│  │  - Engine Detection                 │    │
│  │  - Image Management                 │    │
│  │  - Port Allocation                  │    │
│  │  - PTY Terminal Streaming (node-pty)│    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
              │                  │
              ▼                  ▼
        ┌──────────────┐   ┌───────────────┐
        │ Podman/Docker │ Native Engine   │
        │ Container Eng │ (Alpine WSL2)   │
        └──────────────┘   └───────────────┘
              │                  │
              └──────────┬───────┘
                         ▼
        ┌─────────────────────────────────┐
        │   Linux Container (Guacamole)   │
        │  GUI Desktop Environment Ready  │
        └─────────────────────────────────┘
```

## Use Cases

### 👨‍💻 Development & Learning
- Sandbox environments for experiments
- One container per project—no cross-contamination
- Quick reset if something breaks

### 📚 Education
- Temporary labs that don't pollute your system
- Shareable container specs across classrooms
- Privacy protection (containers auto-delete on logout)

### 🔄 Quick Testing
- Test applications across different Linux distributions
- Verify configuration changes in isolation
- Reproducible test environments

### 🛡️ Malware Research & Security
- Isolated environments for suspicious file analysis
- Network isolation available via container options
- Persistent or ephemeral sessions as needed

## Configuration

### Supported Distros
- Ubuntu (LTS & Latest)
- Fedora
- Arch
- Alpine
- Debian
- CentOS
- Many others via Linuxserver.io images

### Supported GUIs
- XFCE (lightweight & responsive)
- KDE Plasma
- Cinnamon
- MATE
- Openbox
- And more via Linuxserver.io's Webtop project

## Troubleshooting

### Container Won't Start
1. **Check Engine Status**: Verify Podman/Docker is running
2. **Network**: Ensure no firewall is blocking localhost:3000-3999
3. **Disk Space**: Pull operations need ~2-5GB free space
4. **Windows Native Engine Issues**: Run diagnostics in Settings → Debug

### Slow Image Pull
- First-time pulls download 2-4 GB container images
- Subsequent launches skip the pull (cached locally)
- School WiFi? Connect to a faster network if possible

### Private Container Not Resuming
1. Check that container engine is still running
2. Verify port isn't in use by another application
3. Check logs in `~/.config/BrewBoxes/` on Linux or `%APPDATA%/Dznar/BrewBoxes/` on Windows

### Port Conflicts
- BrewBoxes auto-allocates free ports (3000-4000)
- If still conflicted, close other applications using those ranges
- Manually specify port overrides in advanced settings (future version)

**More help?** See [INSTALL.md](INSTALL.md#troubleshooting)

## Development

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Rust (Tauri 2.x)
- **Terminal Streaming**: `portable-pty` + `node-pty` integration
- **Container Support**: Podman, Docker, nerdctl (WSL2)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Dznar/BrewBoxes
cd BrewBoxes

# Install dependencies
npm install

# Build and run in dev mode
npm run tauri dev

# Create production build
npm run tauri build
```

### Project Structure
```
BrewBoxes/
├── src/                    # Frontend (React/TypeScript)
├── src-tauri/             # Backend (Rust)
│   ├── src/lib.rs        # Core container logic
│   └── Cargo.toml        # Rust dependencies
├── package.json          # Node.js tooling config
├── README.md            # This file
├── INSTALL.md           # Installation guide
├── CONTRIBUTING.md      # Contributor guidelines
└── LICENSE              # BSD-3-Clause
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Pull request process
- Common contribution areas

**Quick links:**
- [Open Issues](https://github.com/Dznar/BrewBoxes/issues) - Bugs & feature requests
- [Discussions](https://github.com/Dznar/BrewBoxes/discussions) - Ideas & questions

**Ideas for improvement:**
- [ ] Container image builder (custom distro + GUI combos)
- [ ] Multi-monitor support in web interface
- [ ] Recording/replay of container sessions
- [ ] GPU passthrough support
- [ ] Container resource limits UI
- [ ] Web UI theming options

## License

BrewBoxes is licensed under the **BSD-3-Clause License**. This keeps the project open-source while avoiding the complexity and constraints of other licenses like Apache 2.0.

See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Linuxserver.io](https://www.linuxserver.io/) for excellent Webtop container images
- [Tauri](https://tauri.app/) for the lightweight desktop framework
- [Podman](https://podman.io/) for secure, rootless containers
- Everyone who lost work to deleted folders and reinstalled VMs 100 times 🎓

---

**Questions?** Open an [Issue](https://github.com/Dznar/BrewBoxes/issues) or start a [Discussion](https://github.com/Dznar/BrewBoxes/discussions).

**Want to support?** Star ⭐ this repo and share it with others!
