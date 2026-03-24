import { useState, useEffect } from 'react';
import { RunningContainer, PrivateContainer } from '../App';
import { invoke } from '@tauri-apps/api/core';

interface GUI {
  id: string;
  name: string;
  description: string;
}

interface DistroConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  letter: string;
  guis: GUI[];
}

interface DistroCardProps {
  distro: DistroConfig;
  selectedGui: string | undefined;
  onSelectGui: (distroId: string, guiId: string) => void;
  addStatusMessage: (message: string) => void;
  clearStatusMessages: () => void;
  updateConnectionStatus: (
    message: string,
    type: 'success' | 'error' | 'connecting' | 'info'
  ) => void;
  animationDelay: number;
  runningContainers: RunningContainer[];
  privateContainers: PrivateContainer[];
  addRunningContainer: (container: RunningContainer) => void;
  removeRunningContainer: (containerId: string) => void;
  refreshPrivateContainers: () => Promise<void>;
}

function DistroCard({
  distro,
  selectedGui,
  onSelectGui,
  addStatusMessage,
  clearStatusMessages,
  updateConnectionStatus,
  animationDelay,
  runningContainers,
  privateContainers,
  addRunningContainer,
  removeRunningContainer,
  refreshPrivateContainers,
}: DistroCardProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLaunch = async (isPrivate = false) => {
    if (!selectedGui) {
      updateConnectionStatus('Please select a GUI first!', 'error');
      return;
    }

    if (isPrivate) {
      setShowPrivateModal(true);
      return;
    }

    await performLaunch();
  };

  const performLaunch = async (privateUsername?: string, privatePassword?: string) => {
    setIsLaunching(true);
    clearStatusMessages();
    updateConnectionStatus(
      `Launching ${distro.name} with ${selectedGui.toUpperCase()}...`,
      'connecting'
    );

    try {
      const result: any = await invoke('launch_container', {
        distro: distro.id,
        gui: selectedGui,
        username: privateUsername || null,
        password: privatePassword || null,
      });

      if (result.success) {
        addRunningContainer({
          id: result.container_id,
          distroId: distro.id,
          guiId: selectedGui,
          url: result.url,
          isPrivate: !!(privateUsername && privatePassword),
        });
        updateConnectionStatus(result.message, 'success');
        addStatusMessage(`[SUCCESS] Container launched. ID: ${result.container_id.slice(0, 12)}`);
        addStatusMessage(`[INFO] New window opened at: ${result.url}`);
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      updateConnectionStatus(`Launch failed: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStop = async (containerId: string) => {
    setIsStopping(true);
    updateConnectionStatus('Stopping container...', 'connecting');

    try {
      await invoke('stop_container', { id: containerId });
      updateConnectionStatus('Container stopped successfully', 'success');
      addStatusMessage(`[SUCCESS] Container ${containerId.slice(0, 12)} stopped`);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      updateConnectionStatus(`Error: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsStopping(false);
    }
  };

  const handleDelete = async (containerId: string) => {
    setIsDeleting(true);
    updateConnectionStatus('Deleting container...', 'connecting');

    try {
      await invoke('delete_container', { id: containerId });
      removeRunningContainer(containerId);
      updateConnectionStatus('Container deleted successfully', 'success');
      addStatusMessage(`[SUCCESS] Container ${containerId.slice(0, 12)} deleted`);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      updateConnectionStatus(`Error: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getButtonText = (isPrivate = false) => {
    if (isLaunching) return 'Launching...';
    if (selectedGui) return isPrivate ? `Launch Private Container` : `Launch ${distro.name} with ${selectedGui.toUpperCase()}`;
    return 'Select GUI First';
  };

  const handlePrivateSubmit = () => {
    if (!username || !password) {
      updateConnectionStatus('Please enter both username and password', 'error');
      return;
    }
    setShowPrivateModal(false);
    performLaunch(username, password);
    setUsername('');
    setPassword('');
  };

  const runningContainer = runningContainers.find(
    (c) => c.distroId === distro.id && c.guiId === selectedGui
  );

  const relevantPrivateContainers = privateContainers.filter(
    (c) => c.distro === distro.id && c.gui === selectedGui
  );

  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 hover:border-gray-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl animate-slide-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-center mb-4">
        <div
          className={`w-12 h-12 ${distro.color} rounded-xl flex items-center justify-center mr-4`}
        >
          <span className="text-white font-bold text-lg">{distro.letter}</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold">{distro.name}</h3>
          <p className="text-gray-400 text-sm">{distro.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-gray-300">Available Desktop Environments:</h4>
        <div className="space-y-2">
          {distro.guis.map((gui) => (
            <button
              key={gui.id}
              onClick={() => onSelectGui(distro.id, gui.id)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                selectedGui === gui.id
                  ? `${distro.color} bg-opacity-20 border border-current`
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <span className="font-medium block">{gui.name}</span>
              <span className="text-gray-400 text-sm block">{gui.description}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => handleLaunch(false)}
          disabled={!selectedGui || isLaunching || !!runningContainer}
          className={`w-full mt-4 ${distro.color} hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            isLaunching ? 'animate-pulse' : ''
          }`}
        >
          {getButtonText(false)}
        </button>

        <button
          onClick={() => handleLaunch(true)}
          disabled={!selectedGui || isLaunching || !!runningContainer}
          className={`w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            isLaunching ? 'animate-pulse' : ''
          }`}
        >
          {getButtonText(true)}
        </button>

        {relevantPrivateContainers.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Saved Private Sessions</h4>
            <div className="space-y-3">
              {relevantPrivateContainers.map((pc) => (
                <div key={pc.id} className="bg-gray-800/50 rounded-xl p-3 border border-purple-500/20">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-200">User: <span className="text-purple-300">{pc.username}</span></span>
                    <span className="text-[10px] bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/30">Persistent</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => performLaunch(pc.username, 'dummy')} // Password not needed for resume
                      disabled={isLaunching}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                      Resume
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete session for ${pc.username}? This will erase all data.`)) {
                          await invoke('delete_container', { id: pc.name });
                          refreshPrivateContainers();
                        }
                      }}
                      className="px-3 bg-gray-700 hover:bg-red-900/50 text-gray-400 hover:text-red-200 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {runningContainer && (
          <div className="mt-4 space-y-2 p-3 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-300">
              <span className="font-medium">Running:</span> {runningContainer.id.slice(0, 12)}
              {runningContainer.isPrivate && <span className="ml-2 text-purple-400">(Private)</span>}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => invoke('open_container_window', { 
                    label: `container-${runningContainer.id.slice(0, 12)}`, 
                    url: runningContainer.url 
                  })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
                >
                  Open App
                </button>
                <button
                  onClick={() => invoke('open_in_browser', { url: runningContainer.url })}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
                >
                  Browser
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStop(runningContainer.id)}
                  disabled={isStopping || isDeleting}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStopping ? 'Stopping...' : 'Stop'}
                </button>
                <button
                  onClick={() => handleDelete(runningContainer.id)}
                  disabled={isStopping || isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPrivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPrivateModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-4">Launch Private Container</h3>
            <p className="text-gray-400 text-sm mb-4">
              Enter credentials for your private container. These will be set as environment variables.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter password"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPrivateModal(false);
                  setUsername('');
                  setPassword('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePrivateSubmit}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
              >
                Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DistroCard;
