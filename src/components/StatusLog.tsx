import { useEffect, useRef } from 'react';

interface StatusLogProps {
  messages: string[];
}

function StatusLog({ messages }: StatusLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={logRef}
      className="mb-8 p-4 rounded-lg bg-gray-800 text-left font-mono text-sm text-gray-300 h-48 overflow-y-auto"
    >
      {messages.length === 0 ? (
        <p className="text-gray-500">No activity yet. Select a distribution to get started...</p>
      ) : (
        messages.map((message, index) => (
          <p key={index} className="mb-1">
            {message}
          </p>
        ))
      )}
    </div>
  );
}

export default StatusLog;
