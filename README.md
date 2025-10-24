# BrewBoxes - Linux Container Launcher

A web application similar to Distrosea that allows users to dynamically launch Linux distribution containers with different desktop environments.

## Features

- Launch multiple Linux distributions (Ubuntu, Fedora, Debian, Arch, Alpine, openSUSE)
- Choose from various desktop environments (i3, KDE, MATE, XFCE)
- Dynamic port assignment to avoid conflicts
- Real-time status logging
- Container tracking (temporarily disabled)
- Local API route for container management using direct `child_process.exec` calls
- Automatic detection of Docker or Podman engine
- Dynamic Dockerfile generation for each distro/GUI combination
- Support for up to 24 simultaneous containers

## Architecture

### Frontend
- React + TypeScript + Vite
- Tailwind CSS for styling
- Responsive design with modern UI

### Backend
- Supabase Edge Function (Deno runtime)
- Podman for container management
- PostgreSQL database for tracking containers and port assignments

## Prerequisites

- Podman installed and running
- Node.js (v18 or higher)
- Supabase account (already configured)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure Podman is installed and running:
```bash
podman --version
podman ps
```

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to `http://localhost:5173`

3. Select a Linux distribution and desktop environment

4. Click "Launch" to start a container

5. The container will open in a new tab once ready (may take 30-60 seconds for first launch)

## How It Works

1. **Port Management**: The system automatically finds available ports starting from 3002 (frontend) and 6901 (WebSocket)

2. **Container Launch**: When you launch a distro, the backend:
   - Checks for available ports in the database
   - Creates a container record
   - Runs the Podman command with dynamic port assignment
   - Returns the access URL

3. **Container Tracking**: All containers are tracked in the Supabase database with:
   - Container name and ID
   - Distribution and GUI selection
   - Assigned ports
   - Status and timestamps

4. **Cleanup**: Old containers (inactive for 1+ hour) can be cleaned up via the `/cleanup` endpoint

## API Endpoints

The backend edge function provides these endpoints:

- `POST /functions/v1/container-manager/launch` - Launch a new container
- `GET /functions/v1/container-manager/containers` - List all containers
- `POST /functions/v1/container-manager/cleanup` - Clean up old containers

## Database Schema

### containers table
- `id`: Unique identifier
- `container_name`: Name of the container
- `distro`: Linux distribution
- `gui`: Desktop environment
- `front_port`: Frontend port
- `ws_port`: WebSocket port
- `status`: Current status
- `created_at`: Creation timestamp
- `container_id`: Podman container ID

### port_assignments table
- `id`: Unique identifier
- `port`: Port number
- `port_type`: frontend or websocket
- `in_use`: Boolean flag
- `container_id`: Reference to container
- `assigned_at`: Assignment timestamp

## Container Images

Uses LinuxServer.io webtop images:
- `lscr.io/linuxserver/webtop:ubuntu-{gui}`
- `lscr.io/linuxserver/webtop:fedora-{gui}`
- `lscr.io/linuxserver/webtop:debian-{gui}`
- `lscr.io/linuxserver/webtop:arch-{gui}`
- `lscr.io/linuxserver/webtop:alpine-{gui}`
- `lscr.io/linuxserver/webtop:opensuse-{gui}`

## Build for Production

```bash
npm run build
```

## Notes

- First launch of each distro/GUI combination will take longer as Podman pulls the image
- Containers persist until manually stopped or cleaned up
- Maximum of 24 containers can run simultaneously (configurable)
- Each container gets unique ports to avoid conflicts
