import { exec } from 'child_process';

let detectedEngine: string | null = null;

async function detectContainerEngine(): Promise<string | null> {
  try {
    await execCommandWithOutput('podman --version');
    return 'podman';
  } catch {
    try {
      await execCommandWithOutput('docker --version');
      return 'docker';
    } catch {
      return null;
    }
  }
}

function execCommandWithOutput(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { containerId } = req.body;

  if (!containerId) {
    return res.status(400).json({ success: false, message: 'Missing containerId' });
  }

  if (!detectedEngine) {
    detectedEngine = await detectContainerEngine();
    if (!detectedEngine) {
      return res.status(500).json({ success: false, message: 'No container engine found' });
    }
  }

  try {
    const stopCommand = `${detectedEngine} stop ${containerId}`;
    await execCommandWithOutput(stopCommand);

    res.status(200).json({ success: true, message: 'Container stopped successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to stop container' });
  }
}
