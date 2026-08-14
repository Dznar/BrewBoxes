# Installation Guide

Quick setup instructions for each platform. Choose your OS below.

## 📥 Download

Latest builds are available on the [Releases page](https://github.com/Dznar/BrewBoxes/releases).

---

## Windows

### Prerequisites
- **Windows 10/11** (Home, Pro, or Enterprise)
- **WSL2** OR **Podman/Docker** installed
  - WSL2: Built into Windows 11; Windows 10 needs manual setup
  - Podman/Docker: Download from [podman.io](https://podman.io) or Docker Desktop

### Installation Steps

1. **Download** `BrewBoxes_x.x.x_x64-setup.exe` from [Releases](https://github.com/Dznar/BrewBoxes/releases)
2. **Run installer** - Follow the setup wizard
3. **Launch** - Open BrewBoxes from your Start Menu or Desktop shortcut
4. **Verify Engine** - The app will auto-detect Podman/Docker or WSL2

### Using Native Engine (Recommended)

The Native Engine runs inside WSL2 and doesn't require Docker Desktop:

1. Open BrewBoxes → **Settings**
2. Click **"Setup Native Engine"**
3. Wait for automatic download & configuration (~5-10 minutes, one-time)
4. You're done! ✅

### Troubleshooting

**"Container engine not found"**
- Install Podman Desktop: [podman.io/getting-started](https://podman.io/getting-started)
- Or enable WSL2 and use Native Engine setup

**"WSL2 not enabled"**
```powershell
# Run as Administrator:
wsl --install
# Restart your computer
```

**Port 3000 already in use**
- Close applications using ports 3000-4000
- Future versions will allow custom port selection

---

## macOS

### Prerequisites
- **macOS 11+** (Intel or Apple Silicon)
- **Podman** or **Docker Desktop** installed
  - Podman: `brew install podman`
  - Docker Desktop: [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop)

### Installation Steps

1. **Download** `BrewBoxes_x.x.x_aarch64.dmg` (Apple Silicon) or `x86_64.dmg` (Intel)
2. **Mount** - Double-click the .dmg file
3. **Install** - Drag BrewBoxes to Applications folder
4. **Launch** - Open Applications → BrewBoxes
5. **Verify Engine** - App will auto-detect Podman or Docker

### First Run

On first launch, you may see a security prompt:
- Click **"Open"** to confirm
- Or in System Preferences → Security & Privacy → Allow BrewBoxes

### Troubleshooting

**"Container engine not found"**
```bash
# Install Podman via Homebrew:
brew install podman

# Start Podman machine:
podman machine init
podman machine start

# Restart BrewBoxes
```

**"App is damaged" error**
```bash
# Run in Terminal:
xattr -d com.apple.quarantine /Applications/BrewBoxes.app
```

**Apple Silicon (M1/M2/M3) Performance**
- BrewBoxes includes native ARM64 support
- Use `aarch64.dmg` download for best performance
- Podman/Docker also need ARM64-compatible images

---

## Linux

### Prerequisites
- **Ubuntu 20.04+**, **Fedora 33+**, **Arch**, **Debian 11+**, or similar
- **Podman** or **Docker** installed
  ```bash
  # Ubuntu/Debian:
  sudo apt install podman
  
  # Fedora:
  sudo dnf install podman
  
  # Arch:
  sudo pacman -S podman
  ```

- **User permissions** - Rootless container support
  ```bash
  # Enable rootless mode (one-time):
  podman system migrate
  ```

### Installation Steps

1. **Download** `BrewBoxes_x.x.x_amd64.AppImage` or `.deb` file from [Releases](https://github.com/Dznar/BrewBoxes/releases)

2. **Option A: AppImage** (Recommended for most users)
   ```bash
   # Make executable
   chmod +x BrewBoxes_x.x.x_amd64.AppImage
   
   # Run
   ./BrewBoxes_x.x.x_amd64.AppImage
   ```

3. **Option B: Debian Package** (Ubuntu/Debian)
   ```bash
   sudo apt install ./BrewBoxes_x.x.x_amd64.deb
   
   # Launch from applications menu or:
   brewboxes
   ```

4. **Verify Engine**
   ```bash
   # Check if Podman/Docker is running:
   podman version
   # or
   docker version
   ```

### Desktop Integration

To add BrewBoxes to your application menu (AppImage):

1. Create `~/.local/share/applications/brewboxes.desktop`
2. Paste:
   ```
   [Desktop Entry]
   Version=1.0
   Type=Application
   Name=BrewBoxes
   Exec=/path/to/BrewBoxes_x.x.x_amd64.AppImage
   Icon=brewboxes
   Categories=Development;Utility;
   ```

### Troubleshooting

**"Podman not found"**
```bash
# Install Podman:
sudo apt install podman  # Debian/Ubuntu
sudo dnf install podman  # Fedora
sudo pacman -S podman    # Arch

# Verify:
podman --version
```

**"Permission denied" errors**
```bash
# Ensure you're in the podman group:
sudo usermod -aG podman $USER

# Apply new group (logout & login, or):
newgrp podman

# Verify:
podman run --rm hello-world
```

**AppImage won't launch**
```bash
# Install required libraries:
sudo apt install libfuse2 libssl3  # Ubuntu/Debian
sudo dnf install fuse libssl       # Fedora

# Try again:
./BrewBoxes_x.x.x_amd64.AppImage
```

**"Network issues" with containers**
```bash
# Ensure podman network is initialized:
podman network inspect podman
# If missing, restart podman:
podman system reset
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

# Output location:
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

1. **Launch BrewBoxes** and wait for the UI to load
2. **Check Engine Status** - Should show "Podman" or "Docker" (or "Native" on Windows)
3. **Select Distro** - Choose "Alpine" and "XFCE" (lightweight)
4. **Launch** a test container
5. **Watch the terminal** - You should see real-time installation progress
6. **Access Desktop** - Browser window opens to your Linux environment

---

## Next Steps

- Read [Getting Started](README.md#getting-started) in the main README
- Check [Troubleshooting](README.md#troubleshooting) for common issues
- Join [Discussions](https://github.com/Dznar/BrewBoxes/discussions) for help

---

**Happy containerizing! 🍻**
