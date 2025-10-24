import { useState } from 'react';
import DistroCard from './DistroCard';

interface DistroGridProps {
  addStatusMessage: (message: string) => void;
  clearStatusMessages: () => void;
  updateConnectionStatus: (
    message: string,
    type: 'success' | 'error' | 'connecting' | 'info'
  ) => void;
}

interface DistroConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  letter: string;
  guis: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

const distros: DistroConfig[] = [
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    description: "World's most popular Linux desktop",
    color: 'bg-orange-600',
    letter: 'U',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'kde', name: 'KDE Plasma', description: 'Modern and customizable' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
  {
    id: 'fedora',
    name: 'Fedora',
    description: 'Innovation first, cutting-edge',
    color: 'bg-blue-700',
    letter: 'F',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'kde', name: 'KDE Plasma', description: 'Modern and customizable' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
  {
    id: 'debian',
    name: 'Debian',
    description: 'The universal operating system',
    color: 'bg-pink-700',
    letter: 'D',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'kde', name: 'KDE Plasma', description: 'Modern and customizable' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
  {
    id: 'arch',
    name: 'Arch Linux',
    description: 'Rolling release, advanced users',
    color: 'bg-blue-600',
    letter: 'A',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'kde', name: 'KDE Plasma', description: 'Modern and customizable' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
  {
    id: 'alpine',
    name: 'Alpine Linux',
    description: 'Security-focused, lightweight',
    color: 'bg-blue-800',
    letter: 'A',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
  {
    id: 'opensuse',
    name: 'openSUSE',
    description: 'Enterprise-grade stability',
    color: 'bg-green-700',
    letter: 'O',
    guis: [
      { id: 'i3', name: 'i3', description: 'Tiling window manager' },
      { id: 'mate', name: 'MATE', description: 'Traditional desktop' },
      { id: 'xfce', name: 'XFCE', description: 'Lightweight and fast' },
    ],
  },
];

function DistroGrid({
  addStatusMessage,
  clearStatusMessages,
  updateConnectionStatus,
}: DistroGridProps) {
  const [selectedGuis, setSelectedGuis] = useState<Record<string, string>>({});

  const handleSelectGui = (distroId: string, guiId: string) => {
    setSelectedGuis((prev) => ({
      ...prev,
      [distroId]: guiId,
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {distros.map((distro, index) => (
        <DistroCard
          key={distro.id}
          distro={distro}
          selectedGui={selectedGuis[distro.id]}
          onSelectGui={handleSelectGui}
          addStatusMessage={addStatusMessage}
          clearStatusMessages={clearStatusMessages}
          updateConnectionStatus={updateConnectionStatus}
          animationDelay={index * 100}
        />
      ))}
    </div>
  );
}

export default DistroGrid;
