import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import * as pty from 'node-pty';

let detectedEngine: string | null = null;

async function detectContainerEngine(): Promise<string | null> {
  console.log('API: Attempting to detect container engine...');
  try {
    const { stdout } = await execCommandWithOutput('podman --version');
    if (stdout.includes('podman version')) {
      console.log('API: Podman detected.');
      return 'podman';
    }
  } catch (error) {
    console.log('API: Podman not found or error: ', error.message);
  }

  try {
    const { stdout } = await execCommandWithOutput('docker --version');
    if (stdout.includes('Docker version')) {
      console.log('API: Docker detected.');
      return 'docker';
    }
  } catch (error) {
    console.log('API: Docker not found or error: ', error.message);
  }
  return null;
}

interface ExecCommandResult {
  stdout: string;
  stderr: string;
}

function execCommandWithOutput(command: string): Promise<ExecCommandResult> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`API: execCommandWithOutput error for "${command}": ${error}`);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function execCommandWithPty(
  command: string,
  args: string[],
  onProgress: (data: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env
    });

    ptyProcess.on('data', (data) => {
      console.log('PTY Data:', data);
      onProgress(data);
    });

    ptyProcess.on('exit', ({ exitCode, signal }) => {
      if (exitCode === 0 || (exitCode === undefined && signal === undefined)) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${exitCode}, signal ${signal}`));
      }
    });
  });
}

export default async function handler(req: any, res: any) {
  console.log('API: /api/launch called.');
  if (req.method !== 'POST') {
    console.warn(`API: Method ${req.method} not allowed.`);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { distro, gui } = req.body;
  console.log(`API: Received request for distro: ${distro}, gui: ${gui}`);

  if (!distro || !gui) {
    console.error('API: Missing distro or gui in request body.');
    return res.status(400).json({ success: false, message: 'Missing distro or gui' });
  }

  if (!detectedEngine) {
    console.log('API: Detecting container engine for the first time...');
    detectedEngine = await detectContainerEngine();

    if (!detectedEngine) {
      console.error('API: No container engine (Docker or Podman) found.');
      return res.status(500).json({ success: false, message: 'No container engine (Docker or Podman) found).' });
    }
    console.log(`API: Using container engine: ${detectedEngine}`);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (type: string, message: string, data?: any) => {
    const payload = JSON.stringify({ type, message, ...data });
    res.write(`data: ${payload}\n\n`);
  };

  const imageTag = `lscr.io/linuxserver/webtop:${distro}-${gui}`;
  const containerName = `brewboxes-${distro}-${gui}`;
  let tempDir: string | undefined;

  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brewboxes-'));
    const dockerfileContent = `FROM ${imageTag}`;
    const dockerfilePath = path.join(tempDir, 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfileContent);
    console.log(`API: Dockerfile created at ${dockerfilePath}`);

    sendProgress('status', 'Building image...');

    await execCommandWithPty(
      detectedEngine,
      ['build', '-t', imageTag, tempDir],
      (data) => {
        const lines = data.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes('skipped: already exists') || trimmed.includes('done') || trimmed.includes('STEP 1/1') || trimmed.includes('Trying to pull')) {
            // skip
          } else {
            sendProgress('progress', line);
          }
        }
      }
    );

    sendProgress('status', 'Image built successfully');

    sendProgress('status', 'Allocating ports...');
    const fePort = await findAvailablePort();
    const wsPort = await findAvailablePort();

    sendProgress('status', 'Starting container...');
    const { stdout: runStdout } = await execCommandWithOutput(
      `${detectedEngine} run -d --name ${containerName} -p ${fePort}:3000 -p ${wsPort}:8082 ${imageTag}`
    );

    const containerId = runStdout.trim();
    if (!containerId) {
      throw new Error('Could not determine container ID from run command output.');
    }
    const url = `http://localhost:${fePort}`;

    sendProgress('complete', 'Container launched successfully!', {
      success: true,
      url,
      container_id: containerId,
    });

    res.end();
  } catch (error) {
    console.error('API: Error in /api/launch catch block:', error);
    sendProgress('error', error.message || 'An unknown error occurred during container launch.');
    res.end();
  } finally {
    if (tempDir) {
      console.log(`API: Cleaning up temporary directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
