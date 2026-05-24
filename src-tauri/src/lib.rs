use std::process::Command as StdCommand;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder, Window, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{TcpListener, TcpStream};
use portable_pty::{CommandBuilder, native_pty_system, PtySize};
use std::io::Read;
use std::time::Duration;
use std::thread;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrivateContainer {
    pub id: String,
    pub name: String,
    pub distro: String,
    pub gui: String,
    pub username: String,
    pub port: u16,
}

#[derive(Serialize, Deserialize)]
pub struct LaunchResponse {
    pub success: bool,
    pub message: String,
    pub url: String,
    pub container_id: String,
}

fn get_data_file(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("containers.json");
    path
}

fn load_containers(app: &AppHandle) -> Vec<PrivateContainer> {
    let path = get_data_file(app);
    if let Ok(content) = fs::read_to_string(path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn save_containers(app: &AppHandle, containers: Vec<PrivateContainer>) {
    let path = get_data_file(app);
    let content = serde_json::to_string_pretty(&containers).unwrap();
    let _ = fs::write(path, content);
}

fn find_available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(0)
}

fn wait_for_port(port: u16, timeout_seconds: u64) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(timeout_seconds);

    while start.elapsed() < timeout {
        if TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_millis(500)).is_ok() {
            // Found port, but give it 10 seconds to actually start responding (avoid ERR_EMPTY_RESPONSE)
            // Heavy distros like Arch can take a moment to initialize the web server
            thread::sleep(Duration::from_secs(10));
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn get_engine_dir(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("engine");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

fn detect_engine() -> Result<String, String> {
    if cfg!(windows) {
        // 1. Check for system podman (Official Podman for Windows)
        // We exclude Docker because its energy-saving modes can interfere with pulls.
        let engines = vec!["podman"];
        for engine in engines {
            let mut cmd = StdCommand::new("where");
            cmd.arg(engine);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000);
            
            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    // Double check if engine is responsive (machine is started)
                    let mut check = StdCommand::new(engine);
                    check.arg("version");
                    #[cfg(windows)]
                    check.creation_flags(0x08000000);
                    
                    if check.output().map(|o| o.status.success()).unwrap_or(false) {
                        log::info!("Detected system engine on Windows: {}", engine);
                        return Ok(engine.to_string());
                    }
                }
            }
        }

        // 2. Fallback to Native Engine
        #[cfg(windows)]
        let mut check_distro = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
        #[cfg(not(windows))]
        let mut check_distro = StdCommand::new("wsl");
        
        check_distro.args(["-l", "-q"]);
        #[cfg(windows)]
        check_distro.creation_flags(0x08000000);
        
        if let Ok(output) = check_distro.output() {
            let list = String::from_utf16_lossy(
                &output.stdout.chunks_exact(2)
                    .map(|a| u16::from_le_bytes([a[0], a[1]]))
                    .collect::<Vec<u16>>()
            );
            
            if list.contains("brewboxes-engine") {
                return Ok("native".to_string());
            }
        }
        Err("No container engine found. Please install Podman for Windows or use the 'Setup Native Engine' button.".to_string())
    } else {
        let engines = vec!["podman", "docker"];
        for engine in engines {
            if StdCommand::new(engine).arg("--version").output().is_ok() {
                log::info!("Detected engine via PATH: {}", engine);
                return Ok(engine.to_string());
            }
        }
        Err("No container engine found (podman or docker).".to_string())
    }
}

#[tauri::command]
async fn reset_native_engine(app: AppHandle) -> Result<(), String> {
    if !cfg!(windows) { return Err("Only on Windows".to_string()); }
    
    #[cfg(windows)]
    let mut unregister = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut unregister = StdCommand::new("wsl");

    unregister.args(["--unregister", "brewboxes-engine"]);
    #[cfg(windows)]
    unregister.creation_flags(0x08000000);
    let _ = unregister.status();
    
    // Also clear engine dir
    let engine_dir = get_engine_dir(&app);
    let _ = fs::remove_dir_all(&engine_dir);
    Ok(())
}

#[tauri::command]
async fn debug_native_engine() -> Result<String, String> {
    if !cfg!(windows) { return Err("Only on Windows".to_string()); }
    
    let diag_script = r#"
        echo "--- DATE ---"
        date
        echo "--- ARCHITECTURE ---"
        uname -m
        echo "--- OS VERSION ---"
        cat /etc/alpine-release 2>/dev/null || echo "N/A"
        echo "--- NETWORKING ---"
        ip addr show eth0 | grep -E "inet |mtu" || echo "eth0 not found"
        cat /etc/resolv.conf
        echo "--- DNS TEST ---"
        cat /etc/resolv.conf
        nslookup google.com 8.8.8.8 >/dev/null 2>&1 && echo "DNS (8.8.8.8): OK" || echo "DNS (8.8.8.8): FAILED"
        nslookup google.com >/dev/null 2>&1 && echo "DNS (System): OK" || echo "DNS (System): FAILED"
        echo "--- PING TEST ---"
        ping -c 1 8.8.8.8 >/dev/null 2>&1 && echo "Ping 8.8.8.8: OK" || echo "Ping 8.8.8.8: FAILED"
        echo "Testing connection to OCI Registry..."
        if command -v curl >/dev/null; then
            curl -I -s --connect-timeout 5 https://lscr.io && echo "OCI Connectivity (curl): OK" || echo "OCI Connectivity (curl): FAILED"
        elif command -v wget >/dev/null; then
            wget -q --spider --timeout=5 https://lscr.io && echo "OCI Connectivity (wget): OK" || echo "OCI Connectivity (wget): FAILED"
        else
            echo "Neither_curl_nor_wget_found."
        fi
        echo "--- CONFIG FILES ---"
        ls -l /etc/containers/registries.conf /etc/containers/policy.json /etc/containers/storage.conf /etc/containers/containers.conf 2>/dev/null || echo "Some config files missing"
        echo "--- REGISTRIES ---"
        cat /etc/containers/registries.conf 2>/dev/null || echo "registries.conf not found"
        echo "--- POLICY ---"
        cat /etc/containers/policy.json 2>/dev/null || echo "policy.json not found"
        echo "--- APK PACKAGES ---"
        apk list -I 2>/dev/null | grep -E "podman|crun|conmon|iptables|ca-certificates|util-linux|procps|coreutils|containers-common|cni-plugins" || echo "No relevant packages found"
        echo "--- BINARIES ---"
        ls -l /usr/bin/podman /usr/bin/crun /usr/bin/conmon 2>/dev/null || echo "Some binaries missing"
        echo "--- EXECUTION TEST ---"
        /usr/bin/podman version 2>&1 || echo "podman exec failed"
        echo "--- CGROUPS ---"
        grep -q cgroup2 /proc/filesystems && echo "Kernel supports cgroup2" || echo "Kernel lacks cgroup2"
        mount | grep cgroup2 || echo "cgroup2 not mounted"
        echo "--- LOCAL IMAGES ---"
        /usr/bin/podman images
    "#;

    #[cfg(windows)]
    let mut cmd = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut cmd = StdCommand::new("wsl");

    cmd.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", diag_script]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn start_managed_engine() {
    if !cfg!(windows) { return; }
    
    // Preparation script (Mounts and Networking)
    // No daemon needed for Podman!
    let start_script = r#"
        mkdir -p /run/containerd /var/log/containerd /var/lib/containerd /tmp
        chmod 1777 /tmp
        sysctl -w net.ipv6.conf.all.disable_ipv6=1 >/dev/null 2>&1 || true
        ip link set eth0 mtu 1400 >/dev/null 2>&1 || true
        grep -q "8.8.8.8" /etc/resolv.conf || echo "nameserver 8.8.8.8" >> /etc/resolv.conf
        if ! grep -q cgroup2 /proc/mounts; then
            mount -t cgroup2 none /sys/fs/cgroup 2>/dev/null || true
        fi
    "#;

    #[cfg(windows)]
    let mut cmd = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut cmd = StdCommand::new("wsl");

    cmd.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", start_script]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let _ = cmd.status();
}

fn run_engine_cmd(engine: &str, args: Vec<&str>, _window: Option<&Window>) -> StdCommand {
    if engine == "native" {
        start_managed_engine();

        #[cfg(windows)]
        let mut cmd = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
        #[cfg(not(windows))]
        let mut cmd = StdCommand::new("wsl");

        let mut wsl_args = vec!["-d", "brewboxes-engine", "-u", "root", "--", "/usr/local/bin/nerdctl"];
        wsl_args.extend(args);
        cmd.args(wsl_args);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd
    } else {
        let mut cmd = StdCommand::new(engine);
        cmd.args(args);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd
    }
}

#[tauri::command]
async fn setup_native_engine(window: Window, app: AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Native engine setup is only available on Windows.".to_string());
    }

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => "x86_64",
    };
    
    let nerdctl_arch = if arch == "x86_64" { "amd64" } else { "arm64" };
    let engine_dir = get_engine_dir(&app);
    let rootfs_tar = engine_dir.join(format!("alpine-rootfs-3.23.4-{}.tar.gz", arch));
    let nerdctl_tar = engine_dir.join(format!("nerdctl-full-2.3.1-{}.tar.gz", nerdctl_arch));
    let install_dir = engine_dir.join("distro");

    if !install_dir.exists() {
        fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;
    }

    window.emit("progress", serde_json::json!({"type": "status", "message": format!("Starting Native Engine setup ({arch})...")})).unwrap();

    // 1. Download Alpine RootFS
    if !rootfs_tar.exists() {
        window.emit("progress", serde_json::json!({"type": "status", "message": format!("Downloading minimal Linux base (Alpine 3.23 {arch})...")})).unwrap();
        let mut download = StdCommand::new("curl");
        download.args(["-L", "-f", "-o", rootfs_tar.to_str().unwrap(), &format!("https://dl-cdn.alpinelinux.org/alpine/v3.23/releases/{}/alpine-minirootfs-3.23.4-{}.tar.gz", arch, arch)]);
        #[cfg(windows)]
        download.creation_flags(0x08000000);
        let status = download.status().map_err(|e| format!("Failed to download Alpine: {}", e))?;
        if !status.success() { 
            return Err(format!("Failed to download Alpine rootfs for {}. Please check your connection.", arch)); 
        }
    } else {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Using existing Alpine rootfs."})).unwrap();
    }

    // 2. Download Nerdctl (Container Management)
    if !nerdctl_tar.exists() {
        window.emit("progress", serde_json::json!({"type": "status", "message": format!("Downloading container runtime (Nerdctl 2.3.1 {nerdctl_arch})...")})).unwrap();
        let mut download = StdCommand::new("curl");
        download.args(["-L", "-f", "-o", nerdctl_tar.to_str().unwrap(), &format!("https://github.com/containerd/nerdctl/releases/download/v2.3.1/nerdctl-full-2.3.1-linux-{}.tar.gz", nerdctl_arch)]);
        #[cfg(windows)]
        download.creation_flags(0x08000000);
        let status = download.status().map_err(|e| format!("Failed to download Nerdctl: {}", e))?;
        if !status.success() { return Err(format!("Failed to download Nerdctl bundle for {}.", nerdctl_arch)); }
    }

    // 3. Import WSL Distro
    window.emit("progress", serde_json::json!({"type": "status", "message": "Importing BrewBoxes Engine into WSL..."})).unwrap();
    
    // Unregister first if exists to allow clean re-setup
    #[cfg(windows)]
    let mut unregister = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut unregister = StdCommand::new("wsl");

    unregister.args(["--unregister", "brewboxes-engine"]);
    #[cfg(windows)]
    unregister.creation_flags(0x08000000);
    let _ = unregister.status();

    // Ensure install dir is clean and exists
    if install_dir.exists() {
        let _ = fs::remove_dir_all(&install_dir);
    }
    fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    let mut import = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut import = StdCommand::new("wsl");

    import.args(["--import", "brewboxes-engine", install_dir.to_str().unwrap(), rootfs_tar.to_str().unwrap(), "--version", "2"]);
    #[cfg(windows)]
    import.creation_flags(0x08000000);
    
    let output = import.output().map_err(|e| format!("Failed to execute WSL import: {}", e))?;
    if !output.status.success() { 
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("WSL import failed: {}. Please ensure WSL2 is enabled on your system.", err_msg.trim())); 
    }

    // 4. Extract Nerdctl inside distro
    window.emit("progress", serde_json::json!({"type": "status", "message": "Initializing container runtime inside engine..."})).unwrap();
    
    let win_tar_path = nerdctl_tar.to_str().unwrap();
    let drive_letter = &win_tar_path[0..1].to_lowercase();
    let remaining_path = win_tar_path[3..].replace("\\", "/");
    let wsl_tar_path = format!("/mnt/{}/{}", drive_letter, remaining_path);
    
    // Use gcompat + libc6-compat + libseccomp for maximum binary compatibility on Alpine
    let extract_script = format!(
        "apk add --no-cache libc6-compat libgcc gcompat libseccomp iptables ca-certificates util-linux procps coreutils iproute2 bridge-utils && mkdir -p /usr/local/bin && tar -C /usr/local -xzvf \"{}\"", 
        wsl_tar_path
    );
    
    #[cfg(windows)]
    let mut extract = StdCommand::new("C:\\Windows\\System32\\wsl.exe");
    #[cfg(not(windows))]
    let mut extract = StdCommand::new("wsl");

    extract.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", &extract_script]);
    #[cfg(windows)]
    extract.creation_flags(0x08000000);
    
    let output = extract.output().map_err(|e| format!("Failed to execute initialization: {}", e))?;
    if !output.status.success() { 
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Initialization failed: {}. This might be due to missing dependencies or binary incompatibility.", err_msg.trim())); 
    }

    window.emit("progress", serde_json::json!({"type": "status", "message": "Native Engine setup complete! You can now start using BrewBoxes distros."})).unwrap();
    Ok(())
}

#[tauri::command]
async fn list_private_containers(app: AppHandle) -> Result<Vec<PrivateContainer>, String> {
    Ok(load_containers(&app))
}

#[tauri::command]
async fn open_in_browser(url: String) -> Result<(), String> {
    opener::open(url).map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_container(
    window: Window,
    app: AppHandle,
    distro: String,
    gui: String,
    username: Option<String>,
    password: Option<String>,
) -> Result<LaunchResponse, String> {
    let engine = detect_engine()?;
    let is_private = username.is_some() && password.is_some();
    
    let container_name = if let Some(ref u) = username {
        format!("brewboxes-p-{}-{}-{}", distro, gui, u)
    } else {
        format!("brewboxes-{}-{}", distro, gui)
    };

    // Check if container already exists (for private persistence)
    if is_private {
        let mut inspect_cmd = run_engine_cmd(&engine, vec!["inspect", "--format", "{{.State.Status}}", &container_name], Some(&window));
        let inspect = inspect_cmd.output();

        if let Ok(output) = inspect {
            if output.status.success() {
                let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
                window.emit("progress", serde_json::json!({"type": "status", "message": format!("Found existing session ({}). Starting...", status)})).unwrap();
                
                if status != "running" {
                    let mut start_cmd = run_engine_cmd(&engine, vec!["start", &container_name], Some(&window));
                    let _ = start_cmd.status();
                }

                // Get port
                let format_arg = "{{(index (index .NetworkSettings.Ports \"3000/tcp\") 0).HostPort}}";

                let mut port_cmd = run_engine_cmd(&engine, vec!["inspect", "--format", format_arg, &container_name], Some(&window));
                let port_output = port_cmd.output()
                    .map_err(|e| e.to_string())?;
                
                let port_str = String::from_utf8_lossy(&port_output.stdout).trim().to_string();
                let fe_port: u16 = port_str.parse().map_err(|_| "Failed to parse host port".to_string())?;
                let url = format!("http://localhost:{}", fe_port);

                if !wait_for_port(fe_port, 60) {
                    return Err("Timed out waiting for container web interface to resume.".to_string());
                }

                let window_label = format!("container-{}", &container_name);
                let url_parsed: tauri::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
                
                WebviewWindowBuilder::new(&app, window_label, WebviewUrl::External(url_parsed))
                    .title(format!("Brew Box - {} {} ({})", distro, gui, username.unwrap()))
                    .inner_size(1024.0, 768.0)
                    .build()
                    .map_err(|e| e.to_string())?;

                return Ok(LaunchResponse {
                    success: true,
                    message: "Private session resumed successfully!".to_string(),
                    url,
                    container_id: container_name,
                });
            }
        }
    }

    window.emit("progress", serde_json::json!({"type": "status", "message": format!("Checking engine status ({})...", engine)})).unwrap();
    
    // Check if engine is responsive
    let mut info_cmd = run_engine_cmd(&engine, vec!["info"], Some(&window));
    let info = info_cmd.output();
    
    if info.is_err() || !info.as_ref().unwrap().status.success() {
        let err_msg = if let Ok(out) = info {
            String::from_utf8_lossy(&out.stderr).to_string()
        } else {
            "Engine not responsive".to_string()
        };
        return Err(format!("Container engine is not running or responsive. Please ensure Docker/Podman is started, or use the Native Engine. Error: {}", err_msg));
    }

    let image_tag = if distro == "alpine" && gui == "xfce" {
        "lscr.io/linuxserver/webtop:latest".to_string()
    } else {
        format!("lscr.io/linuxserver/webtop:{}-{}", distro, gui)
    };

    // Check if image already exists locally to avoid unnecessary pull/build
    let mut img_cmd = run_engine_cmd(&engine, vec!["images", "-q", &image_tag], Some(&window));
    let image_check = img_cmd.output();
    
    let needs_pull = if let Ok(output) = image_check {
        String::from_utf8_lossy(&output.stdout).trim().is_empty()
    } else {
        true
    };

    if needs_pull {
        if engine == "native" {
            // Pre-check connectivity on native engine to avoid long hangs
            // We try a simple DNS lookup first as it's fastest and most likely to fail early
            let mut dns_check = StdCommand::new("wsl");
            dns_check.args(["-d", "brewboxes-engine", "-u", "root", "--", "nslookup", "lscr.io"]);
            #[cfg(windows)]
            dns_check.creation_flags(0x08000000);
            
            if !dns_check.status().map(|s| s.success()).unwrap_or(false) {
                return Err("DNS resolution failed inside the Native Engine. This usually means WSL has no internet access. Try restarting WSL (wsl --shutdown) or checking your firewall.".to_string());
            }

            // Then try a quick TCP connect if curl exists
            let mut check_cmd = StdCommand::new("wsl");
            check_cmd.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", "command -v curl >/dev/null && curl -I -s --connect-timeout 2 https://lscr.io || command -v wget >/dev/null && wget -q --spider --timeout=2 https://lscr.io || true"]);
            #[cfg(windows)]
            check_cmd.creation_flags(0x08000000);
            
            if !check_cmd.status().map(|s| s.success()).unwrap_or(false) {
                return Err("Registry (lscr.io) is unreachable from inside the Native Engine. If you are on a VPN or restrictive network, this might be blocked. Click 'Debug' for more details.".to_string());
            }
        }

        window.emit("progress", serde_json::json!({"type": "status", "message": format!("Image not found locally. Pulling {}...", image_tag)})).unwrap();

        // Use PTY for rich animated progress bars on all platforms
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = if engine == "native" {
            // For native engine on Windows, we need to wrap the WSL call for PTY
            // Use absolute path to wsl.exe for robustness
            #[cfg(windows)]
            let mut c = CommandBuilder::new("C:\\Windows\\System32\\wsl.exe");
            #[cfg(not(windows))]
            let mut c = CommandBuilder::new("wsl");
            
            c.args(["-d", "brewboxes-engine", "-u", "root", "--", "podman", "pull", &image_tag]);
            c
        } else {
            let mut c = CommandBuilder::new(&engine);
            c.args(["pull", &image_tag]);
            c
        };

        // Force TTY-like behavior and color output
        cmd.env("TERM", "xterm-256color");

        log::info!("Spawning pull command (PTY): {:?}", cmd);
        let mut child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn pull: {}", e))?;
        drop(pair.slave);

        window.emit("progress", serde_json::json!({"type": "status", "message": "Streaming pull logs..."})).unwrap();

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let window_clone = window.clone();

        thread::spawn(move || {
            let mut buffer = [0u8; 1024]; // Smaller chunks for more frequent updates without flooding
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 { break; }
                let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                let _ = window_clone.emit("progress", serde_json::json!({"type": "progress", "message": output}));
                
                // Small sleep to prevent saturating the Tauri event bridge on Windows
                #[cfg(windows)]
                thread::sleep(Duration::from_millis(5));
            }
        });

        let wait_res = child.wait().map_err(|e| format!("Failed to wait for pull: {}", e))?;
        log::info!("Pull process (PTY) exited: {:?}", wait_res);

        if !wait_res.success() {
            return Err("Image pull failed. This usually happens if the extraction crashes or connection drops. Click Launch again to resume.".to_string());
        }
        window.emit("progress", serde_json::json!({"type": "status", "message": "Pull completed!"})).unwrap();
    } else {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Image found locally. Skipping pull."})).unwrap();
    }
    window.emit("progress", serde_json::json!({"type": "status", "message": "Allocating ports..."})).unwrap();
    let fe_port = find_available_port();
    let ws_port = find_available_port();

    window.emit("progress", serde_json::json!({"type": "status", "message": format!("Starting container using {}...", engine)})).unwrap();

    // Pre-flight Cleanup for non-private containers
    // Since nerdctl doesn't support -d and --rm together, we manually 
    // remove any existing container with this name to prevent stacking.
    if !is_private {
        let mut rm_cmd = run_engine_cmd(&engine, vec!["rm", "-f", &container_name], Some(&window));
        let _ = rm_cmd.status();
    }

    let mut run_args = vec!["run", "-d", "--name", &container_name];

    // Skip --rm for native engine as it conflicts with -d
    if !is_private && engine != "native" {
        run_args.push("--rm");
    }

    let mut env_vars = Vec::new();
    if let (Some(u), Some(p)) = (&username, &password) {
        env_vars.push(format!("CUSTOM_USER={}", u));
        env_vars.push(format!("PASSWORD={}", p));
    }

    for env in &env_vars {
        run_args.push("-e");
        run_args.push(env);
    }

    let p1 = format!("{}:3000", fe_port);
    let p2 = format!("{}:8082", ws_port);
    run_args.push("-p");
    run_args.push(&p1);
    run_args.push("-p");
    run_args.push(&p2);
    run_args.push(&image_tag);

    let mut run_cmd = run_engine_cmd(&engine, run_args, Some(&window));
    let output = run_cmd.output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Run failed: {}", err));
    }

    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let url = format!("http://localhost:{}", fe_port);

    window.emit("progress", serde_json::json!({"type": "status", "message": "Waiting for web interface..."})).unwrap();
    if !wait_for_port(fe_port, 60) {
        return Err("Timed out waiting for container web interface to start.".to_string());
    }

    // Save metadata if private
    if is_private {
        let mut containers = load_containers(&app);
        containers.push(PrivateContainer {
            id: container_id.clone(),
            name: container_name.clone(),
            distro: distro.clone(),
            gui: gui.clone(),
            username: username.unwrap(),
            port: fe_port,
        });
        save_containers(&app, containers);
    }

    let window_label = format!("container-{}", &container_name);
    let url_parsed: tauri::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    
    WebviewWindowBuilder::new(&app, window_label, WebviewUrl::External(url_parsed))
        .title(format!("Brew Box - {} {}", distro, gui))
        .inner_size(1024.0, 768.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(LaunchResponse {
        success: true,
        message: "Container launched and saved!".to_string(),
        url,
        container_id,
    })
}

#[tauri::command]
async fn open_container_window(app: AppHandle, label: String, url: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        let url_parsed: tauri::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
        WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url_parsed))
            .title("Brew Box")
            .inner_size(1024.0, 768.0)
            .build()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn stop_container(id: String) -> Result<(), String> {
    let engine = detect_engine()?;
    let mut cmd = run_engine_cmd(&engine, vec!["stop", &id], None);
    
    let status = cmd.status()
        .map_err(|e| e.to_string())?;
    
    if !status.success() {
        return Err("Failed to stop container".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn delete_container(app: AppHandle, id: String) -> Result<(), String> {
    let engine = detect_engine()?;
    
    // Stop first
    let mut stop_cmd = run_engine_cmd(&engine, vec!["stop", &id], None);
    let _ = stop_cmd.status();

    // Remove
    let mut rm_cmd = run_engine_cmd(&engine, vec!["rm", "-f", &id], None);
    
    let status = rm_cmd.status()
        .map_err(|e| e.to_string())?;
    
    if !status.success() {
        return Err("Failed to delete container".to_string());
    }

    // Also remove from JSON
    let mut containers = load_containers(&app);
    containers.retain(|c| c.id != id && c.name != id);
    save_containers(&app, containers);

    Ok(())
}

#[tauri::command]
async fn check_engine_status() -> Result<Option<String>, String> {
    match detect_engine() {
        Ok(engine) => Ok(Some(engine)),
        Err(_) => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        list_private_containers,
        launch_container,
        stop_container,
        delete_container,
        open_in_browser,
        open_container_window,
        setup_native_engine,
        check_engine_status,
        reset_native_engine,
        debug_native_engine
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
