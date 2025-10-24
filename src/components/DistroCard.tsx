import { useState } from 'react';
import { RunningContainer } from '../App';


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
  addRunningContainer: (container: RunningContainer) => void;
  removeRunningContainer: (containerId: string) => void;
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
  addRunningContainer,
  removeRunningContainer,
}: DistroCardProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLaunch = async () => {
    if (!selectedGui) {
      updateConnectionStatus('Please select a GUI first!', 'error');
      return;
    }

    setIsLaunching(true);
    clearStatusMessages();
    updateConnectionStatus(
      `Launching ${distro.name} with ${selectedGui.toUpperCase()}...`,
      'connecting'
    );

    try {
      const response = await fetch('/api/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distro: distro.id,
          gui: selectedGui,
        }),
      });

      const data = await response.json();

      if (data.status_updates) {
        data.status_updates.forEach((update: string) => {
          addStatusMessage(update);
        });
      }

      if (data.success) {
        addRunningContainer({
          id: data.container_id,
          distroId: distro.id,
          guiId: selectedGui,
          url: data.url,
        });
        updateConnectionStatus(data.message, 'success');
        addStatusMessage(`[SUCCESS] Container accessible at: ${data.url}`);
        addStatusMessage('[INFO] Opening in new tab...');

        setTimeout(() => {
          window.open(data.url, '_blank');
        }, 1000);
      } else {
        updateConnectionStatus(`Launch failed: ${data.message}`, 'error');
        addStatusMessage(`[ERROR] ${data.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateConnectionStatus(`Error: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStop = async (containerId: string) => {
    setIsStopping(true);
    updateConnectionStatus('Stopping container...', 'connecting');

    try {
      const response = await fetch('/api/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ containerId }),
      });

      const data = await response.json();

      if (data.success) {
        updateConnectionStatus('Container stopped successfully', 'success');
        addStatusMessage(`[SUCCESS] Container ${containerId.slice(0, 12)} stopped`);
      } else {
        updateConnectionStatus(`Stop failed: ${data.message}`, 'error');
        addStatusMessage(`[ERROR] ${data.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ containerId }),
      });

      const data = await response.json();

      if (data.success) {
        removeRunningContainer(containerId);
        updateConnectionStatus('Container deleted successfully', 'success');
        addStatusMessage(`[SUCCESS] Container ${containerId.slice(0, 12)} deleted`);
      } else {
        updateConnectionStatus(`Delete failed: ${data.message}`, 'error');
        addStatusMessage(`[ERROR] ${data.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateConnectionStatus(`Error: ${errorMessage}`, 'error');
      addStatusMessage(`[ERROR] ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getButtonText = () => {
    if (isLaunching) return 'Launching...';
    if (selectedGui) return `Launch ${distro.name} with ${selectedGui.toUpperCase()}`;
    return 'Select GUI First';
  };

  const runningContainer = runningContainers.find(
    (c) => c.distroId === distro.id && c.guiId === selectedGui
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
          onClick={handleLaunch}
          disabled={!selectedGui || isLaunching || !!runningContainer}
          className={`w-full mt-4 ${distro.color} hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            isLaunching ? 'animate-pulse' : ''
          }`}
        >
          {getButtonText()}
        </button>

        {runningContainer && (
          <div className="mt-4 space-y-2 p-3 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-300">
              <span className="font-medium">Running:</span> {runningContainer.id.slice(0, 12)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(runningContainer.url, '_blank')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
              >
                Open
              </button>
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
        )}
      </div>
    </div>
  );
}

export default DistroCard;
