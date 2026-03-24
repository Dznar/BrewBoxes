import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatusLog from './components/StatusLog';
import DistroGrid from './components/DistroGrid';
import Footer from './components/Footer';
import ConnectionStatus from './components/ConnectionStatus';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface RunningContainer {
  id: string;
  distroId: string;
  guiId: string;
  url: string;
  isPrivate?: boolean;
}

export interface PrivateContainer {
  id: string;
  name: string;
  distro: string;
  gui: string;
  username: string;
  port: number;
}

function App() {
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [runningContainers, setRunningContainers] = useState<RunningContainer[]>([]);
  const [privateContainers, setPrivateContainers] = useState<PrivateContainer[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'connecting' | 'info';
    visible: boolean;
  }>({
    message: '',
    type: 'info',
    visible: false,
  });

  const addStatusMessage = (message: string) => {
    setStatusMessages((prev) => [...prev, message]);
  };

  const refreshPrivateContainers = useCallback(async () => {
    try {
      const containers = await invoke<PrivateContainer[]>('list_private_containers');
      setPrivateContainers(containers);
    } catch (error) {
      console.error('Failed to list private containers:', error);
    }
  }, []);

  useEffect(() => {
    refreshPrivateContainers();

    let unlisten: () => void;
    
    const setupListener = async () => {
      unlisten = await listen<any>('progress', (event) => {
        const data = event.payload;
        if (data.type === 'status') {
          addStatusMessage(`[INFO] ${data.message}`);
        } else if (data.type === 'progress') {
          // Keep the raw message (with ANSI codes) for the terminal renderer
          if (data.message) {
            addStatusMessage(data.message);
          }
        }
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshPrivateContainers]);

  const clearStatusMessages = () => {
    setStatusMessages([]);
  };

  const updateConnectionStatus = (
    message: string,
    type: 'success' | 'error' | 'connecting' | 'info'
  ) => {
    setConnectionStatus({ message, type, visible: true });

    if (type === 'success') {
      setTimeout(() => {
        setConnectionStatus((prev) => ({ ...prev, visible: false }));
      }, 5000);
    }
  };

  const addRunningContainer = (container: RunningContainer) => {
    setRunningContainers((prev) => [...prev, container]);
    if (container.isPrivate) {
      refreshPrivateContainers();
    }
  };

  const removeRunningContainer = (containerId: string) => {
    setRunningContainers((prev) => prev.filter((c) => c.id !== containerId));
    refreshPrivateContainers();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-inter">
      <Header />

      <main className="container mx-auto px-4 pb-12">
        <ConnectionStatus
          message={connectionStatus.message}
          type={connectionStatus.type}
          visible={connectionStatus.visible}
        />

        <StatusLog messages={statusMessages} />

        <DistroGrid
          addStatusMessage={addStatusMessage}
          clearStatusMessages={clearStatusMessages}
          updateConnectionStatus={updateConnectionStatus}
          runningContainers={runningContainers}
          privateContainers={privateContainers}
          addRunningContainer={addRunningContainer}
          removeRunningContainer={removeRunningContainer}
          refreshPrivateContainers={refreshPrivateContainers}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
