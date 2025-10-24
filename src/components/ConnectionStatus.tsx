interface ConnectionStatusProps {
  message: string;
  type: 'success' | 'error' | 'connecting' | 'info';
  visible: boolean;
}

function ConnectionStatus({ message, type, visible }: ConnectionStatusProps) {
  if (!visible) return null;

  const statusClasses = {
    success: 'bg-green-900/20 border-green-500 text-green-400',
    error: 'bg-red-900/20 border-red-500 text-red-400',
    connecting: 'bg-blue-900/20 border-blue-500 text-blue-400',
    info: 'bg-gray-700 border-gray-500 text-gray-300',
  };

  return (
    <div
      className={`mb-8 p-4 rounded-lg text-center font-medium border ${statusClasses[type]} animate-slide-up`}
    >
      {message}
    </div>
  );
}

export default ConnectionStatus;
