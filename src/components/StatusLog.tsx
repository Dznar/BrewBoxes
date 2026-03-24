import { useEffect, useRef } from 'react';
import AnsiComponent from 'ansi-to-react';

// Handle both ESM and CJS import patterns for React 19 compatibility
const Ansi = (AnsiComponent as any).default || AnsiComponent;

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
      className="mb-8 p-4 rounded-lg bg-gray-900 text-left font-mono text-sm text-gray-300 h-64 overflow-y-auto border border-gray-700 shadow-inner"
    >
      {messages.length === 0 ? (
        <p className="text-gray-500 italic">No activity yet. Select a distribution to get started...</p>
      ) : (
        <div className="whitespace-pre-wrap">
          {messages.map((message, index) => (
            <div key={index} className="mb-1 leading-relaxed">
              <Ansi linkify={false}>{message}</Ansi>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StatusLog;
