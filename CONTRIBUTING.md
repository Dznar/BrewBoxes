# Contributing to BrewBoxes

Thank you for your interest in contributing to BrewBoxes! This document provides guidelines and instructions for getting involved.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Report issues responsibly

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/BrewBoxes.git
cd BrewBoxes
git remote add upstream https://github.com/Dznar/BrewBoxes.git
```

### 2. Set Up Development Environment

#### Prerequisites
- **Node.js**: 18+ ([https://nodejs.org](https://nodejs.org))
- **Rust**: 1.70+ ([https://rustup.rs](https://rustup.rs))
- **Tauri CLI**: Install via `npm install -g @tauri-apps/cli`

#### Install Dependencies
```bash
npm install
```

#### Development Build
```bash
npm run tauri dev
```

This launches the app in dev mode with hot-reload. The Rust backend will recompile on changes.

#### Production Build
```bash
npm run tauri build
```

Outputs platform-specific binaries in `src-tauri/target/release/bundle/`.

### 3. Project Structure

```
BrewBoxes/
├── src/                          # React Frontend
│   ├── App.tsx                  # Main component
│   ├── components/              # UI components
│   └── App.css                  # Styling
├── src-tauri/                   # Rust Backend
│   ├── src/
│   │   ├── main.rs             # Entry point
│   │   └── lib.rs              # Core logic
│   │       ├── launch_container()    # Container launch orchestration
│   │       ├── setup_native_engine() # Windows native engine setup
│   │       ├── detect_engine()       # Podman/Docker detection
│   │       └── (PTY streaming functions)
│   └── Cargo.toml
├── package.json                 # Node.js config
├── tauri.conf.json             # Tauri config
└── README.md
```

### 4. Key Code Areas

#### Frontend (TypeScript/React)
- **UI/UX**: `src/components/` - Container launcher UI, settings, status displays
- **State Management**: Invoke Rust commands via `@tauri-apps/api`
- **Styling**: TailwindCSS classes in `src/App.css`

**Making Frontend Changes:**
```bash
npm run tauri dev
# Edit files in src/ and see hot-reload
```

#### Backend (Rust)
- **Container Management**: `src-tauri/src/lib.rs` lines ~418-699 (launch_container)
- **Engine Detection**: `src-tauri/src/lib.rs` lines ~89-141 (detect_engine)
- **Native Engine (WSL2)**: `src-tauri/src/lib.rs` lines ~301-405 (setup_native_engine)
- **Terminal Streaming**: Lines ~515-608 (PTY/piped output handling)

**Making Backend Changes:**
```bash
# Change will auto-recompile in dev mode
# Check logs in terminal where you ran `npm run tauri dev`
```

## Common Contribution Areas

### 🐛 Bug Fixes
1. Open an issue describing the bug
2. Create a branch: `git checkout -b fix/bug-name`
3. Fix the issue with tests if applicable
4. Commit: `git commit -m "Fix: description of fix"`
5. Push and open a PR

### ✨ New Features
1. Discuss in [Issues](https://github.com/Dznar/BrewBoxes/issues) first to align on approach
2. Create a branch: `git checkout -b feat/feature-name`
3. Implement feature
4. Test thoroughly (especially cross-platform)
5. Commit: `git commit -m "Feat: description of feature"`
6. Push and open a PR with detailed description

### 📚 Documentation
- Update README.md for user-facing changes
- Add inline Rust doc comments for backend functions: `/// Function description`
- Update CONTRIBUTING.md if workflow changes

### 🔧 Improvements
- Performance optimizations
- Code cleanup & refactoring
- Dependency updates
- Error handling enhancements

## Pull Request Process

1. **Before Submitting:**
   - Test on multiple platforms (Windows, macOS, Linux) if possible
   - Ensure no console errors or warnings
   - Run `cargo check` in `src-tauri/` to verify Rust compilation
   - Keep commits atomic and well-messaged

2. **PR Title & Description:**
   ```
   Title: [Type] Brief description
   
   Description:
   - What problem does this solve?
   - How does it work?
   - Any breaking changes?
   - Testing performed?
   ```

   Types: `Fix`, `Feat`, `Docs`, `Refactor`, `Test`, `Chore`

3. **CI/CD:**
   - GitHub Actions will auto-test your build on all platforms
   - All checks must pass before merge
   - See [build artifacts](#releases--builds) if tests fail

4. **Review & Merge:**
   - Address feedback from maintainers
   - Squash commits if requested
   - Merge once approved

## Testing

### Manual Testing Checklist
- [ ] Launch public container (Alpine + XFCE)
- [ ] Launch private container with credentials
- [ ] Resume existing private container
- [ ] Test on target OS (Windows/macOS/Linux)
- [ ] Verify PTY terminal streams correctly
- [ ] Test engine switching (Podman ↔ Docker)
- [ ] Delete/stop containers cleanly

### Cross-Platform Testing
Due to platform differences, test on:
- **Windows**: Native Engine setup, WSL2 integration, path handling
- **macOS**: Podman/Docker integration, app signing
- **Linux**: PTY rendering, engine auto-detection

## Code Style

### Rust
- Use `cargo fmt` for formatting: `cargo fmt --all`
- Use `cargo clippy` for linting: `cargo clippy --all`
- Follow Rust naming conventions (snake_case for functions/vars)
- Add doc comments for public functions

### TypeScript/React
- Use `prettier` for formatting (configured in package.json)
- Follow React hooks conventions
- Prefer functional components
- Keep component files < 300 lines (split if needed)

## Commits & Versioning

### Commit Messages
Use the format: `[Type] Description`
- `[Fix]` - Bug fixes
- `[Feat]` - New features
- `[Docs]` - Documentation
- `[Refactor]` - Code improvements
- `[Test]` - Test additions

Example:
```
[Feat] Add GPU passthrough support
[Fix] Correct port allocation race condition
[Docs] Update README with troubleshooting guide
```

### Versioning
BrewBoxes uses semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes

Update in `src-tauri/Cargo.toml` and `package.json` when releasing.

## Releases & Builds

### GitHub Actions
Builds are automated:
- **Trigger**: Push to `main` branch or manual workflow dispatch
- **Platforms**: Windows, macOS (Intel + Apple Silicon), Linux
- **Artifacts**: See [Actions tab](https://github.com/Dznar/BrewBoxes/actions)

### Creating a Release
1. Update version in `src-tauri/Cargo.toml` and `package.json`
2. Create a git tag: `git tag v1.2.3`
3. Push tag: `git push origin v1.2.3`
4. Go to [Releases](https://github.com/Dznar/BrewBoxes/releases) and create release notes
5. Attach build artifacts from the corresponding GitHub Actions run
6. Publish release

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/Dznar/BrewBoxes/discussions)
- **Bug Report?** Open an [Issue](https://github.com/Dznar/BrewBoxes/issues)
- **Feature Idea?** Start a Discussion or Issue for feedback

## License

By contributing to BrewBoxes, you agree that your contributions will be licensed under the [BSD-3-Clause License](LICENSE).

---

**Thank you for contributing to BrewBoxes! 🍻**
