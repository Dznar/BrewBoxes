BrewBoxes is a container based Browser Compatible Linux,
It has pre-built Linux GUI accessible with a simple one click and run.

Optional Environment Variables¶
Variable 				Description
CUSTOM_PORT 			Internal HTTP port. Defaults to 3000.
CUSTOM_HTTPS_PORT 	Internal HTTPS port. Defaults to 3001.
CUSTOM_WS_PORT 		Internal port the container listens on for websockets if it needs to be swapped from the default 8082.
CUSTOM_USER 			Username for HTTP Basic Auth. Defaults to abc.
PASSWORD 			Password for HTTP Basic Auth. If unset, authentication is disabled.
SUBFOLDER 			Application subfolder for reverse proxy configurations. Must include leading and trailing slashes, e.g., /subfolder/.
TITLE 				Page title displayed in the web browser. Defaults to "Selkies".
START_DOCKER 		If set to false, the privileged Docker-in-Docker setup will not start automatically.
DISABLE_IPV6 			Set to true to disable IPv6 support in the container.
LC_ALL 				Sets the container's locale, e.g., fr_FR.UTF-8.
DRINODE 				If mounting in /dev/dri for DRI3 GPU Acceleration allows you to specify the device to use IE /dev/dri/renderD128
NO_DECOR 			If set, applications will run without window borders, suitable for PWA usage.
NO_FULL 				If set, applications will not be automatically fullscreened.
DISABLE_ZINK 			If set, Zink-related environment variables will not be configured when a video card is detected.
WATERMARK_PNG 		Full path to a watermark PNG file inside the container, e.g., /usr/share/selkies/www/icon.png.
WATERMARK_LOCATION 	Integer specifying the watermark location: 1 (Top Left), 2 (Top Right), 3 (Bottom Left), 4 (Bottom Right), 5 (Centered), 6 (Animated).


Future Features, we plan to add a Tunnel system into and between containers for acrosss devices communication and utilize 'Containerlab' for communication between containers and each other or host system.
