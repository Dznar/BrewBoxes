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
            // Found port, but give it 5 seconds to actually start responding (avoid ERR_EMPTY_RESPONSE)
            // Heavy distros like Arch can take a moment to initialize the web server
            thread::sleep(Duration::from_secs(5));
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
        // Strictly use Native Engine on Windows
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
                // Verify if nerdctl is actually installed inside
                let mut check_binary = StdCommand::new("wsl");
                check_binary.args(["-d", "brewboxes-engine", "-u", "root", "--", "ls", "/usr/local/bin/nerdctl"]);
                #[cfg(windows)]
                check_binary.creation_flags(0x08000000);
                
                if let Ok(out) = check_binary.output() {
                    if out.status.success() {
                        log::info!("Detected native engine: brewboxes-engine (verified)");
                        return Ok("native".to_string());
                    }
                }
            }
        }
        Err("Native Engine not found or incomplete. Please use the 'Setup Native Engine' button.".to_string())
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
        echo "--- OS VERSION ---"
        cat /etc/alpine-release 2>/dev/null || echo "N/A"
        echo "--- COMPATIBILITY ---"
        ls -l /lib64/ld-linux-x86-64.so.2 2>/dev/null || echo "glibc symlink missing"
        echo "--- APK PACKAGES ---"
        apk list -I 2>/dev/null | grep -E "compat|gcc|seccomp|iptables|ca-certificates" || echo "No relevant packages found"
        echo "--- BINARIES ---"
        ls -l /usr/local/bin/nerdctl /usr/local/bin/containerd /usr/local/bin/runc 2>/dev/null || echo "Some binaries missing"
        echo "--- PROCESSES ---"
        ps aux | grep -E "containerd|nerdctl" | grep -v grep
        echo "--- SOCKET ---"
        ls -l /run/containerd/containerd.sock 2>/dev/null || echo "Socket missing"
        echo "--- LOGS ---"
        [ -f /var/log/containerd.log ] && tail -n 50 /var/log/containerd.log || echo "No logs found"
        echo "--- DEPENDENCIES ---"
        echo "nerdctl:"
        ldd /usr/local/bin/nerdctl 2>&1
        echo "containerd:"
        ldd /usr/local/bin/containerd 2>&1
    "#;

    let mut cmd = StdCommand::new("wsl");
    cmd.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", diag_script]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_engine_cmd(engine: &str, args: Vec<&str>, _window: Option<&Window>) -> StdCommand {
    if engine == "native" {
        // Robust containerd startup and socket check
        let start_script = r#"
            mkdir -p /run/containerd /var/lib/containerd
            if ! pgrep containerd > /dev/null; then
                # Ensure we have a log file we can write to
                touch /var/log/containerd.log
                # Start containerd with nohup and redirect to log
                nohup /usr/local/bin/containerd > /var/log/containerd.log 2>&1 &
                # Wait up to 10 seconds for the socket to appear
                for i in $(seq 1 50); do
                    [ -S /run/containerd/containerd.sock ] && break
                    sleep 0.2
                done
            fi
        "#;
        
        let mut start_cmd = StdCommand::new("wsl");
        start_cmd.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", start_script]);
        #[cfg(windows)]
        start_cmd.creation_flags(0x08000000);
        let _ = start_cmd.status();

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

    let engine_dir = get_engine_dir(&app);
    let rootfs_tar = engine_dir.join("alpine-rootfs-3.24.0.tar.gz");
    let nerdctl_tar = engine_dir.join("nerdctl-full-2.3.1.tar.gz");
    let install_dir = engine_dir.join("distro");

    if !install_dir.exists() {
        fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;
    }

    window.emit("progress", serde_json::json!({"type": "status", "message": "Starting Native Engine setup..."})).unwrap();

    // 1. Download Alpine RootFS
    if !rootfs_tar.exists() {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Downloading minimal Linux base (Alpine 3.24)..."})).unwrap();
        let mut download = StdCommand::new("curl");
        download.args(["-L", "-o", rootfs_tar.to_str().unwrap(), "https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/x86_64/alpine-minirootfs-3.24.0-x86_64.tar.gz"]);
        #[cfg(windows)]
        download.creation_flags(0x08000000);
        let status = download.status().map_err(|e| format!("Failed to download Alpine: {}", e))?;
        if !status.success() { return Err("Failed to download Alpine rootfs.".to_string()); }
    }

    // 2. Download Nerdctl (Container Management)
    if !nerdctl_tar.exists() {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Downloading container runtime (Nerdctl)..."})).unwrap();
        let mut download = StdCommand::new("curl");
        download.args(["-L", "-o", nerdctl_tar.to_str().unwrap(), "https://github.com/containerd/nerdctl/releases/download/v2.3.1/nerdctl-full-2.3.1-linux-amd64.tar.gz"]);
        #[cfg(windows)]
        download.creation_flags(0x08000000);
        let status = download.status().map_err(|e| format!("Failed to download Nerdctl: {}", e))?;
        if !status.success() { return Err("Failed to download Nerdctl bundle.".to_string()); }
    }

    // 3. Import WSL Distro
    window.emit("progress", serde_json::json!({"type": "status", "message": "Importing BrewBoxes Engine into WSL..."})).unwrap();
    
    // Unregister first if exists to allow clean re-setup
    let mut unregister = StdCommand::new("wsl");
    unregister.args(["--unregister", "brewboxes-engine"]);
    #[cfg(windows)]
    unregister.creation_flags(0x08000000);
    let _ = unregister.status();

    let mut import = StdCommand::new("wsl");
    import.args(["--import", "brewboxes-engine", install_dir.to_str().unwrap(), rootfs_tar.to_str().unwrap(), "--version", "2"]);
    #[cfg(windows)]
    import.creation_flags(0x08000000);
    let status = import.status().map_err(|e| format!("Failed to import WSL distro: {}", e))?;
    if !status.success() { return Err("WSL import failed. Please ensure WSL2 is enabled on your system.".to_string()); }

    // 4. Extract Nerdctl inside distro
    window.emit("progress", serde_json::json!({"type": "status", "message": "Initializing container runtime inside engine..."})).unwrap();
    
    let win_tar_path = nerdctl_tar.to_str().unwrap();
    let drive_letter = &win_tar_path[0..1].to_lowercase();
    let remaining_path = win_tar_path[3..].replace("\\", "/");
    let wsl_tar_path = format!("/mnt/{}/{}", drive_letter, remaining_path);
    
    // Use gcompat + libc6-compat + libseccomp for maximum binary compatibility on Alpine
    let extract_script = format!(
        "apk add --no-cache libc6-compat libgcc gcompat libseccomp iptables ca-certificates util-linux && mkdir -p /usr/local/bin && tar -C /usr/local -xzvf \"{}\"", 
        wsl_tar_path
    );
    
    let mut extract = StdCommand::new("wsl");
    extract.args(["-d", "brewboxes-engine", "-u", "root", "--", "sh", "-c", &extract_script]);
    #[cfg(windows)]
    extract.creation_flags(0x08000000);
    let status = extract.status().map_err(|e| format!("Failed to extract nerdctl: {}", e))?;
    if !status.success() { 
        return Err("Failed to initialize container runtime inside WSL.".to_string()); 
    }

    window.emit("progress", serde_json::json!({"type": "status", "message": "Native Engine setup complete!"})).unwrap();
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

                if !wait_for_port(fe_port, 30) {
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
        window.emit("progress", serde_json::json!({"type": "status", "message": format!("Image not found locally. Pulling {}...", image_tag)})).unwrap();

        if cfg!(windows) || engine == "native" {
            // Windows or Native: Use standard piped command to avoid PTY/TTY handshake hangs
            let mut pull_cmd = run_engine_cmd(&engine, vec!["pull", &image_tag], Some(&window));
            pull_cmd.stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());
            
            let mut child = pull_cmd.spawn()
                .map_err(|e| format!("Failed to spawn pull: {}", e))?;

            let stdout = child.stdout.take().unwrap();
            let stderr = child.stderr.take().unwrap();
            let window_clone = window.clone();

            window.emit("progress", serde_json::json!({"type": "status", "message": "Streaming pull logs (Safe Mode)..."})).unwrap();

            // Handle stdout
            let window_stdout = window_clone.clone();
            thread::spawn(move || {
                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        let _ = window_stdout.emit("progress", serde_json::json!({"type": "progress", "message": format!("{}\n", l)}));
                    }
                }
            });

            // Handle stderr
            let window_stderr = window_clone.clone();
            thread::spawn(move || {
                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        let _ = window_stderr.emit("progress", serde_json::json!({"type": "progress", "message": format!("{}\n", l)}));
                    }
                }
            });

            let wait_res = child.wait().map_err(|e| format!("Failed to wait for pull: {}", e))?;
            log::info!("Pull process exited: {:?}", wait_res);
            
            if !wait_res.success() {
                return Err("Image pull failed. This usually happens if the engine crashes or loses its connection. If you're using Docker Desktop, try switching to the Native Engine in Settings.".to_string());
            }
        } else {
            // Linux (non-native): Use PTY for rich animated progress bars
            let pty_system = native_pty_system();
            let pair = pty_system
                .openpty(PtySize {
                    rows: 24,
                    cols: 80,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string())?;

            let mut cmd = CommandBuilder::new(&engine);
            // Force TTY-like behavior and color output
            cmd.env("TERM", "xterm-256color");
            cmd.args(["pull", &image_tag]);

            log::info!("Spawning pull command (PTY): {} pull {}", engine, image_tag);
            let mut child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn pull: {}", e))?;
            drop(pair.slave);

            window.emit("progress", serde_json::json!({"type": "status", "message": "Streaming pull logs..."})).unwrap();

            let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
            let window_clone = window.clone();

            thread::spawn(move || {
                let mut buffer = [0u8; 4096]; // Larger buffer for progress chunks
                log::info!("PTY reader thread started.");
                while let Ok(n) = reader.read(&mut buffer) {
                    if n == 0 { 
                        log::info!("PTY reader reached EOF.");
                        break; 
                    }
                    let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = window_clone.emit("progress", serde_json::json!({"type": "progress", "message": output}));
                }
            });

            let wait_res = child.wait().map_err(|e| format!("Failed to wait for pull: {}", e))?;
            log::info!("Pull process (PTY) exited: {:?}", wait_res);

            if !wait_res.success() {
                return Err("Image pull failed.".to_string());
            }
        }
        window.emit("progress", serde_json::json!({"type": "status", "message": "Pull completed!"})).unwrap();
    } else {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Image found locally. Skipping pull."})).unwrap();
    }
    window.emit("progress", serde_json::json!({"type": "status", "message": "Allocating ports..."})).unwrap();
    let fe_port = find_available_port();
    let ws_port = find_available_port();

    window.emit("progress", serde_json::json!({"type": "status", "message": format!("Starting container using {}...", engine)})).unwrap();

    let mut run_args = vec!["run", "-d", "--name", &container_name];

    // Only add --rm if NOT private
    if !is_private {
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
    if !wait_for_port(fe_port, 30) {
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
