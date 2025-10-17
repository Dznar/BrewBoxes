#!/bin/bash

# Load assigned ports if it exists
if [ -f "ports.log" ]; then
  assigned_ports=($(cat ports.log))
else
  assigned_ports=()
fi

# Function to find the next available port
get_next_slot() {
  local start_port=$1
  while netstat -tuln | grep -q ":$start_port" || [[ " ${assigned_ports[@]} " =~ " $start_port " ]]; do
    ((start_port++))
  done
  echo $start_port
}

# Create or overwrite the docker-compose.yml
echo "version: '3'" > docker-compose.yml

# Loop to create 24 different containers
for (( i=1; i<=24; i++ )); do
  front_port=$(get_next_slot 3000)  # Start looking for frontend ports from 3000
  ws_port=$(get_next_slot 6901)      # Start looking for WebSocket ports from 6901
  
  # Automatically assign the container name based on the naming convention
  container_name="app_${i}"
  
  # Write to the docker-compose.yml
  cat <<EOL >> docker-compose.yml
  ${container_name}:
    image: your-image
    ports:
      - "$front_port:3000"  # Frontend port
      - "$ws_port:6901"      # WebSocket port
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Etc/UTC
      - CUSTOM_PORT=$front_port
      - CUSTOM_WS_PORT=$ws_port
      #- COPY icon.png /usr/share/selkies/www/icon.png
EOL

  # Track the assigned ports
  assigned_ports+=($front_port $ws_port)
done

# Save ports to a log for future runs
printf "%s\n" "${assigned_ports[@]}" > ports.log

# After launching each container, this line to output the URL for access
echo "Container $container_name is accessible at http://localhost:$front_port"

# Run Docker Compose
docker-compose up -d
