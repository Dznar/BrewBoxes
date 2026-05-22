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
            // Found port, but give it 2 seconds to actually start responding (avoid ERR_EMPTY_RESPONSE)
            thread::sleep(Duration::from_secs(2));
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn detect_engine() -> Result<String, String> {
    if cfg!(windows) {
        let engines = vec!["podman.exe", "docker.exe"];
        for engine in &engines {
            let mut cmd = StdCommand::new("where");
            cmd.arg(engine);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            
            let output = cmd.output();
            if let Ok(out) = output {
                if out.status.success() {
                    for line in String::from_utf8_lossy(&out.stdout).lines() {
                        let path = line.trim();
                        if !path.is_empty() && path.to_lowercase().ends_with(".exe") {
                            log::info!("Detected engine via where (.exe): {}", path);
                            return Ok(path.to_string());
                        }
                    }
                }
            }
        }
        Err("No container engine found (podman.exe or docker.exe). Please ensure Podman or Docker Desktop is installed and in your PATH.".to_string())
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
        let mut inspect_cmd = StdCommand::new(&engine);
        inspect_cmd.args(["inspect", "--format", "{{.State.Status}}", &container_name]);
        #[cfg(windows)]
        inspect_cmd.creation_flags(0x08000000);
        let inspect = inspect_cmd.output();

        if let Ok(output) = inspect {
            if output.status.success() {
                let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
                window.emit("progress", serde_json::json!({"type": "status", "message": format!("Found existing session ({}). Starting...", status)})).unwrap();
                
                if status != "running" {
                    let mut start_cmd = StdCommand::new(&engine);
                    start_cmd.args(["start", &container_name]);
                    #[cfg(windows)]
                    start_cmd.creation_flags(0x08000000);
                    let _ = start_cmd.status();
                }

                // Get port
                let mut port_cmd = StdCommand::new(&engine);
                port_cmd.args(["inspect", "--format", "{{(index (index .NetworkSettings.Ports \"3000/tcp\") 0).HostPort}}", &container_name]);
                #[cfg(windows)]
                port_cmd.creation_flags(0x08000000);
                let port_output = port_cmd.output()
                    .map_err(|e| e.to_string())?;
                
                let port_str = String::from_utf8_lossy(&port_output.stdout).trim().to_string();
                let fe_port: u16 = port_str.parse().map_err(|_| "Failed to parse host port".to_string())?;
                let url = format!("http://localhost:{}", fe_port);

                if !wait_for_port(fe_port, 15) {
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
    let mut info_cmd = StdCommand::new(&engine);
    info_cmd.arg("info");
    #[cfg(windows)]
    info_cmd.creation_flags(0x08000000);
    let info = info_cmd.output();
    
    if info.is_err() || !info.as_ref().unwrap().status.success() {
        let err_msg = if let Ok(out) = info {
            String::from_utf8_lossy(&out.stderr).to_string()
        } else {
            "Engine not responsive".to_string()
        };
        return Err(format!("Container engine is not running or responsive. Please ensure Docker/Podman is started. Error: {}", err_msg));
    }

    let image_tag = if distro == "alpine" && gui == "xfce" {
        "lscr.io/linuxserver/webtop:latest".to_string()
    } else {
        format!("lscr.io/linuxserver/webtop:{}-{}", distro, gui)
    };

    // Check if image already exists locally to avoid unnecessary pull/build
    let mut img_cmd = StdCommand::new(&engine);
    img_cmd.args(["images", "-q", &image_tag]);
    #[cfg(windows)]
    img_cmd.creation_flags(0x08000000);
    let image_check = img_cmd.output();
    
    let needs_pull = if let Ok(output) = image_check {
        String::from_utf8_lossy(&output.stdout).trim().is_empty()
    } else {
        true
    };

    if needs_pull {
        window.emit("progress", serde_json::json!({"type": "status", "message": format!("Image not found locally. Pulling {}...", image_tag)})).unwrap();

        if cfg!(windows) {
            // Windows: Use standard piped command to avoid PTY/TTY handshake hangs with Docker Desktop
            let mut pull_cmd = StdCommand::new(&engine);
            pull_cmd.args(["pull", &image_tag])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());
            #[cfg(windows)]
            pull_cmd.creation_flags(0x08000000);
            
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

            let wait_res = child.wait();
            log::info!("Pull process (StdCommand) exited: {:?}", wait_res);
        } else {
            // Linux: Use PTY for rich animated progress bars
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

            let wait_res = child.wait();
            log::info!("Pull process (PTY) exited: {:?}", wait_res);
        }
        window.emit("progress", serde_json::json!({"type": "status", "message": "Pull completed!"})).unwrap();
    } else {
        window.emit("progress", serde_json::json!({"type": "status", "message": "Image found locally. Skipping pull."})).unwrap();
    }
    window.emit("progress", serde_json::json!({"type": "status", "message": "Allocating ports..."})).unwrap();
    let fe_port = find_available_port();
    let ws_port = find_available_port();

    window.emit("progress", serde_json::json!({"type": "status", "message": format!("Starting container using {}...", engine)})).unwrap();

    let mut run_args = vec!["run".to_string(), "-d".to_string(), "--name".to_string(), container_name.clone()];

    // Only add --rm if NOT private
    if !is_private {
        run_args.push("--rm".to_string());
    }

    if let (Some(u), Some(p)) = (&username, &password) {
        run_args.push("-e".to_string());
        run_args.push(format!("CUSTOM_USER={}", u));
        run_args.push("-e".to_string());
        run_args.push(format!("PASSWORD={}", p));
    }

    run_args.push("-p".to_string());
    run_args.push(format!("{}:3000", fe_port));
    run_args.push("-p".to_string());
    run_args.push(format!("{}:8082", ws_port));
    run_args.push(image_tag);

    let mut run_cmd = StdCommand::new(&engine);
    run_cmd.args(run_args);
    #[cfg(windows)]
    run_cmd.creation_flags(0x08000000);

    let output = run_cmd.output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Run failed: {}", err));
    }

    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let url = format!("http://localhost:{}", fe_port);

    window.emit("progress", serde_json::json!({"type": "status", "message": "Waiting for web interface..."})).unwrap();
    if !wait_for_port(fe_port, 15) {
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
    let mut cmd = StdCommand::new(&engine);
    cmd.args(["stop", &id]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    
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
    let mut stop_cmd = StdCommand::new(&engine);
    stop_cmd.args(["stop", &id]);
    #[cfg(windows)]
    stop_cmd.creation_flags(0x08000000);
    let _ = stop_cmd.status();

    // Remove
    let mut rm_cmd = StdCommand::new(&engine);
    rm_cmd.args(["rm", "-f", &id]);
    #[cfg(windows)]
    rm_cmd.creation_flags(0x08000000);
    
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
        open_container_window
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
