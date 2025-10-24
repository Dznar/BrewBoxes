import { useState } from 'react';
import Header from './components/Header';
import StatusLog from './components/StatusLog';
import DistroGrid from './components/DistroGrid';
import Footer from './components/Footer';
import ConnectionStatus from './components/ConnectionStatus';

function App() {
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
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
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
