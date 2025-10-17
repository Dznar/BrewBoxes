class DistroLauncher {
    constructor() {
        this.websocket = null;
        this.selectedDistros = new Map(); // Track selected GUI for each distro
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initWebSocket();
    }

    setupEventListeners() {
        // Handle GUI selection
        document.querySelectorAll('.gui-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const distroCard = e.target.closest('.distro-card');
                const distro = distroCard.dataset.distro;
                const gui = e.target.dataset.gui;
                
                this.selectGUI(distro, gui, distroCard);
            });
        });

        // Handle launch buttons
        document.querySelectorAll('.launch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const distroCard = e.target.closest('.distro-card');
                const distro = distroCard.dataset.distro;
                
                this.launchDistro(distro);
            });
        });
    }

    selectGUI(distro, gui, distroCard) {
        // Remove previous selection in this card
        distroCard.querySelectorAll('.gui-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Add selection to clicked button
        event.target.classList.add('selected');

        // Update selected distros map
        this.selectedDistros.set(distro, gui);

        // Enable launch button and update text
        const launchBtn = distroCard.querySelector('.launch-btn');
        launchBtn.disabled = false;
        launchBtn.textContent = `Launch ${this.formatDistroName(distro)} with ${gui.toUpperCase()}`;

        // Add animation effect
        launchBtn.classList.add('animate-slide-up');
        setTimeout(() => launchBtn.classList.remove('animate-slide-up'), 300);
    }

    initWebSocket() {
        try {
            this.websocket = new WebSocket('ws://localhost:8082');
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('Connected to container service', 'success');
            };

            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                this.updateConnectionStatus('Disconnected from container service', 'error');
                
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    this.initWebSocket();
                }, 3000);
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Connection error - check if backend is running', 'error');
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.updateConnectionStatus('Failed to connect - check if backend is running on localhost:8080', 'error');
        }
    }

launchDistro(distro) {
    const selectedGUI = this.selectedDistros.get(distro);
    
    if (!selectedGUI) {
        this.showNotification('Please select a GUI first!', 'error');
        return;
    }

    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        this.showNotification('WebSocket connection not available', 'error');
        return;
    }

    const distroCard = document.querySelector(`[data-distro="${distro}"]`);
    const launchBtn = distroCard.querySelector('.launch-btn');
    
    launchBtn.classList.add('launching');
    launchBtn.textContent = 'Launching...';
    launchBtn.disabled = true;

    const launchRequest = {
        action: 'launch',
        distro: distro,
        gui: selectedGUI,
        timestamp: new Date().toISOString()
    };

    this.websocket.send(JSON.stringify(launchRequest));
    
    this.updateConnectionStatus(`Launching ${this.formatDistroName(distro)} with ${selectedGUI.toUpperCase()}...`, 'connecting');

    // Listen for a response from the WebSocket
    this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
    };
}

handleWebSocketMessage(data) {
    console.log('WebSocket message received:', data);
    
    switch (data.type) {
        case 'launch_success':
            this.updateConnectionStatus(`${this.formatDistroName(data.distro)} launched successfully!`, 'success');
            this.resetLaunchButton(data.distro);
            
            // Redirect to the container URL
            window.location.href = data.url; // Ensure the backend sends the URL
            break;
            
        case 'launch_error':
            this.updateConnectionStatus(`Failed to launch ${this.formatDistroName(data.distro)}: ${data.message}`, 'error');
            this.resetLaunchButton(data.distro);
            break;
            
        case 'container_ready':
            this.updateConnectionStatus(`Container is ready! Access URL: ${data.url}`, 'success');
            break;
            
        default:
            console.log('Unknown message type:', data.type);
    }
}


    resetLaunchButton(distro) {
        const distroCard = document.querySelector(`[data-distro="${distro}"]`);
        const launchBtn = distroCard.querySelector('.launch-btn');
        const selectedGUI = this.selectedDistros.get(distro);
        
        launchBtn.classList.remove('launching');
        launchBtn.disabled = false;
        launchBtn.textContent = `Launch ${this.formatDistroName(distro)} with ${selectedGUI.toUpperCase()}`;
    }

    updateConnectionStatus(message, type) {
        const statusElement = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        statusElement.className = `mb-8 p-4 rounded-lg text-center font-medium status-${type}`;
        statusText.textContent = message;
        statusElement.classList.remove('hidden');

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.classList.add('hidden');
            }, 5000);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm animate-slide-up status-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    formatDistroName(distro) {
        const names = {
            ubuntu: 'Ubuntu',
            fedora: 'Fedora',
            debian: 'Debian',
            arch: 'Arch Linux',
            alpine: 'Alpine Linux',
            enterprise: 'Enterprise Linux'
        };
        return names[distro] || distro;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DistroLauncher();
});

// Add some interactive effects
document.addEventListener('DOMContentLoaded', () => {
    // Add hover effects to cards
    document.querySelectorAll('.distro-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
        });
    });

    // Add ripple effect to buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});