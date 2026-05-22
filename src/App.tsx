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
  const [engineStatus, setEngineStatus] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
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

  const checkEngine = useCallback(async () => {
    try {
      const status = await invoke<string | null>('check_engine_status');
      setEngineStatus(status);
    } catch (error) {
      console.error('Failed to check engine status:', error);
    }
  }, []);

  const handleSetupNativeEngine = async () => {
    setIsSettingUp(true);
    clearStatusMessages();
    updateConnectionStatus('Setting up Native Engine...', 'connecting');
    try {
      await invoke('setup_native_engine');
      updateConnectionStatus('Native Engine setup successful!', 'success');
      await checkEngine();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      updateConnectionStatus(`Setup failed: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsSettingUp(false);
    }
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
    checkEngine();

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
        {!engineStatus && (
          <div className="mb-8 bg-amber-900/40 border border-amber-500/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-amber-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-amber-200">No Container Engine Detected</h3>
                <p className="text-amber-100/70">Docker or Podman was not found. We can set up a minimal native engine for you.</p>
              </div>
            </div>
            <button
              onClick={handleSetupNativeEngine}
              disabled={isSettingUp}
              className="bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
            >
              {isSettingUp ? 'Setting up...' : 'Setup Native Engine'}
            </button>
          </div>
        )}

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
