import { useState } from 'react';


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
}

function DistroCard({
  distro,
  selectedGui,
  onSelectGui,
  addStatusMessage,
  clearStatusMessages,
  updateConnectionStatus,
  animationDelay,
}: DistroCardProps) {
  const [isLaunching, setIsLaunching] = useState(false);

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

  const getButtonText = () => {
    if (isLaunching) return 'Launching...';
    if (selectedGui) return `Launch ${distro.name} with ${selectedGui.toUpperCase()}`;
    return 'Select GUI First';
  };

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
          disabled={!selectedGui || isLaunching}
          className={`w-full mt-4 ${distro.color} hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            isLaunching ? 'animate-pulse' : ''
          }`}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}

export default DistroCard;
