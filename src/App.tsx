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
          if (data.message) {
            // Check for carriage return (\r) which usually indicates a progress bar update
            if (data.message.includes('\r')) {
              setStatusMessages(prev => {
                const newMessages = [...prev];
                // Replace the last message with the new progress update
                if (newMessages.length > 0) {
                  newMessages[newMessages.length - 1] = data.message.replace(/\r/g, '');
                } else {
                  newMessages.push(data.message.replace(/\r/g, ''));
                }
                return newMessages;
              });
            } else {
              addStatusMessage(data.message);
            }
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

  const [debugOutput, setDebugOutput] = useState<string | null>(null);

  const handleResetEngine = async () => {
    if (confirm('Are you sure you want to reset the Native Engine? This will delete all local images and data.')) {
      updateConnectionStatus('Resetting Native Engine...', 'connecting');
      try {
        await invoke('reset_native_engine');
        updateConnectionStatus('Engine reset successful!', 'success');
        setEngineStatus(null);
      } catch (error) {
        updateConnectionStatus('Reset failed', 'error');
      }
    }
  };

  const handleDebugEngine = async () => {
    try {
      const debug = await invoke<string>('debug_native_engine');
      setDebugOutput(debug);
    } catch (error) {
      setDebugOutput(`Debug failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-inter">
      <Header />

      <main className="container mx-auto px-4 pb-12">
        <div className="mb-8 bg-amber-900/40 border border-amber-500/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${engineStatus ? 'bg-green-500 text-green-900' : 'bg-amber-500 text-amber-900'} rounded-full flex items-center justify-center`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-200">
                {engineStatus ? 'Native Engine Active' : 'Native Engine Not Ready'}
              </h3>
              <p className="text-amber-100/70">
                {engineStatus 
                  ? 'The stable container engine is ready to use.' 
                  : 'Docker/Podman are disabled on Windows. Please set up the reliable Native Engine.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {!engineStatus ? (
              <button
                onClick={handleSetupNativeEngine}
                disabled={isSettingUp}
                className="bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
              >
                {isSettingUp ? 'Setting up...' : 'Setup Native Engine'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDebugEngine}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-xl transition-all"
                >
                  Debug
                </button>
                <button
                  onClick={handleResetEngine}
                  className="bg-red-900/50 hover:bg-red-800/50 text-red-200 font-medium py-2 px-6 rounded-xl border border-red-500/30 transition-all"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        {debugOutput && (
          <div className="mb-8 bg-black/80 rounded-2xl p-6 border border-blue-500/30 font-mono text-xs overflow-auto max-h-96 relative">
            <button 
              onClick={() => setDebugOutput(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕ Close
            </button>
            <h4 className="text-blue-400 mb-4 uppercase text-[10px] tracking-widest">Engine Diagnostics</h4>
            <pre className="text-blue-100">{debugOutput}</pre>
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
