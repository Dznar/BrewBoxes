# Installation Guide

Quick setup instructions for each platform. Choose your OS below.

## 📥 Download

Latest release: **[v1.0.0](https://github.com/Dznar/BrewBoxes/releases/tag/v1.0.0)**

Download your platform from the [Releases page](https://github.com/Dznar/BrewBoxes/releases).

---

## Windows

### Prerequisites
- **Windows 10/11** (Home, Pro, or Enterprise)
- **Podman or Docker** (recommended over WSL2 for better performance)
  - **Recommended**: [Podman Desktop](https://podman.io) - Rootless, faster, no bloat
  - Alternative: [Docker Desktop](https://docker.com/products/docker-desktop)
  
⚠️ **Why not WSL2?** WSL2 has I/O bottlenecks that slow down container image pulls. Running Podman/Docker on a hypervisor (Hyper-V) is significantly faster.

### Installation Steps

1. **Install Podman Desktop** (Recommended)
   ```
   Download from: https://podman.io/getting-started/installation/windows
   ```
   - Handles Hyper-V setup automatically
   - Better performance than WSL2
   - No Docker Desktop required

2. **Download BrewBoxes**
   - Get `Brew Boxes_1.0.0_x64-setup.exe` from [Releases](https://github.com/Dznar/BrewBoxes/releases)

3. **Run Installer** - Follow the setup wizard

4. **Launch BrewBoxes** - From Start Menu or Desktop shortcut

5. **Verify Engine** - App will auto-detect Podman/Docker

### Alternative: Docker Desktop

If you prefer Docker Desktop:
1. Install from [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop)
2. Launch Docker Desktop (keep it running)
3. Launch BrewBoxes
4. You're ready to go

### Performance Tips

```
Rank by Performance (Fast → Slow):
1. 🚀 Podman Desktop (Hyper-V)     ← Best option
2. 🐋 Docker Desktop (Hyper-V)     ← Good alternative  
3. 🐢 WSL2 + Podman/Docker         ← Slower I/O
```

### Troubleshooting

**"Container engine not found"**
- Install Podman Desktop from https://podman.io
- Or install Docker Desktop from https://docker.com

**Hyper-V not available**
- Windows 10/11 Pro/Enterprise required for Hyper-V
- Home edition: Install Docker Desktop (uses Hyper-V behind the scenes)

**Slow image pulls**
- Switch from WSL2 to Podman Desktop (hypervisor mode)
- Should see 2-3x faster pulls

---

## macOS

### Prerequisites
- **macOS 11+** (Intel or Apple Silicon)
- **Podman** or **Docker Desktop**
  - **Recommended**: [Podman](https://podman.io) - Lightweight, fast
  - Alternative: [Docker Desktop](https://docker.com/products/docker-desktop)

### Installation Steps

1. **Install Podman** (Recommended)
   ```bash
   brew install podman
   podman machine init
   podman machine start
   ```

2. **Download BrewBoxes**
   - Intel: `Brew Boxes_1.0.0_x86_64.dmg`
   - Apple Silicon: `Brew Boxes_1.0.0_aarch64.dmg`
   - From [Releases](https://github.com/Dznar/BrewBoxes/releases)

3. **Mount & Install**
   - Double-click the .dmg file
   - Drag BrewBoxes to Applications folder

4. **Launch** - Open Applications → BrewBoxes

5. **First Run** - May see security prompt, click "Open"

### Alternative: Docker Desktop

```bash
# Install via Homebrew
brew install --cask docker

# Or download: https://docker.com/products/docker-desktop
```

### Troubleshooting

**"Container engine not found"**
```bash
# Install Podman:
brew install podman
podman machine init
podman machine start

# Or install Docker Desktop
brew install --cask docker
```

**"App is damaged" error**
```bash
xattr -d com.apple.quarantine /Applications/BrewBoxes.app
```

**Apple Silicon Performance**
- BrewBoxes includes native ARM64 support
- Use `aarch64.dmg` (Apple Silicon version)
- Ensure Podman/Docker also have ARM64 support

---

## Linux

### Prerequisites
- **Ubuntu 20.04+**, **Fedora 33+**, **Arch**, **Debian 11+**, or similar
- **Podman** or **Docker**

### Installation Steps

1. **Install Podman or Docker**
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install podman
   ```
   
   **Fedora:**
   ```bash
   sudo dnf install podman
   ```
   
   **Arch:**
   ```bash
   sudo pacman -S podman
   ```

2. **Enable Rootless Mode** (one-time setup)
   ```bash
   podman system migrate
   ```

3. **Download BrewBoxes**
   - `Brew Boxes_1.0.0_amd64.deb` (Debian/Ubuntu) or
   - Universal AppImage from [Releases](https://github.com/Dznar/BrewBoxes/releases)

4. **Install**
   
   **Debian/Ubuntu (.deb):**
   ```bash
   sudo apt install ./Brew\ Boxes_1.0.0_amd64.deb
   ```
   
   **AppImage (any distro):**
   ```bash
   chmod +x Brew\ Boxes_1.0.0_amd64.AppImage
   ./Brew\ Boxes_1.0.0_amd64.AppImage
   ```

5. **Launch**
   - From applications menu, or:
   ```bash
   brewboxes
   ```

### Desktop Integration (AppImage)

1. Create `~/.local/share/applications/brewboxes.desktop`:
   ```
   [Desktop Entry]
   Version=1.0
   Type=Application
   Name=BrewBoxes
   Exec=/path/to/Brew\ Boxes_1.0.0_amd64.AppImage
   Icon=brewboxes
   Categories=Development;Utility;
   ```

2. Update menus:
   ```bash
   update-desktop-database ~/.local/share/applications/
   ```

### Troubleshooting

**"Podman not found"**
```bash
sudo apt install podman  # Ubuntu/Debian
sudo dnf install podman  # Fedora
sudo pacman -S podman    # Arch
```

**"Permission denied" errors**
```bash
# Add user to podman group
sudo usermod -aG podman $USER

# Apply immediately:
newgrp podman

# Verify:
podman run --rm hello-world
```

**AppImage won't launch**
```bash
# Install FUSE:
sudo apt install libfuse2  # Ubuntu/Debian
sudo dnf install fuse      # Fedora

# Try again:
./Brew\ Boxes_1.0.0_amd64.AppImage
```

---

## Building from Source

### Prerequisites
- **Node.js** 18+
- **Rust** 1.70+
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Build Steps

```bash
# Clone repository
git clone https://github.com/Dznar/BrewBoxes.git
cd BrewBoxes

# Install dependencies
npm install

# Build for your platform
npm run tauri build

# Output locations:
# Windows: src-tauri/target/release/bundle/msi/
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/appimage/
```

### Development Mode

```bash
npm run tauri dev

# This launches BrewBoxes in dev mode with hot-reload
# Changes to src/ (React) and src-tauri/src/ (Rust) auto-update
```

---

## Verification

After installation, verify everything works:

1. **Launch BrewBoxes**
2. **Check Engine Status** - Should show "Podman" or "Docker"
3. **Select Distro** - Choose "Alpine" and "XFCE" (lightweight)
4. **Launch Container** - Click "Launch"
5. **Watch Terminal** - See real-time installation progress
6. **Access Desktop** - Browser window opens to your Linux environment

---

## Next Steps

- Read [Getting Started](README.md#getting-started) in the main README
- Watch the [demo video](https://dl.dropbox.com/scl/fi/jj3ncr01vbetq12mzeded/allBrew.mp4?rlkey=qrcswsnxpblpo463rr7bpx7k4&st=bylsb3z4&dl=0)
- Check [Troubleshooting](README.md#troubleshooting) for common issues
- Join [Discussions](https://github.com/Dznar/BrewBoxes/discussions) for help

---

**Happy containerizing! 🍻**
