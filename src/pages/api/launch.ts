import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net'; // Import net module

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
    const server = net.createServer(); // Use net.createServer()
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

  const imageTag = `lscr.io/linuxserver/webtop:${distro}-${gui}`;
  const containerName = `brewboxes-${distro}-${gui}`;
  let tempDir: string | undefined;

  try {
    // Create a temporary directory for the Dockerfile
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brewboxes-'));
    const dockerfileContent = `FROM ${imageTag}\n\nENV PUID=1000\nENV PGID=1000\nENV TZ=Etc/UTC\n\nENTRYPOINT ["/init"]`;
    const dockerfilePath = path.join(tempDir, 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfileContent);
    console.log(`API: Dockerfile created at ${dockerfilePath}`);

    console.log(`API: Attempting to build image: ${imageTag} from ${tempDir}`);
    // Build the image (if not already built)
    const buildCommand = `${detectedEngine} build -t ${imageTag} ${tempDir}`;
    const { stdout: buildStdout, stderr: buildStderr } = await execCommandWithOutput(buildCommand);
    console.log('API: Build command stdout:', buildStdout);
    console.log('API: Build command stderr:', buildStderr);

    const fePort = await findAvailablePort();
    const wsPort = await findAvailablePort();
    console.log(`API: Allocated ports - FE: ${fePort}, WS: ${wsPort}`);

    console.log(`API: Attempting to run container: ${containerName}`);
    // Run the container
    const runCommand = `${detectedEngine} run -d --name ${containerName} -p ${fePort}:3000 -p ${wsPort}:8082 ${imageTag}`;
    console.log(`API: Run command: ${runCommand}`);
    const { stdout: runStdout, stderr: runStderr } = await execCommandWithOutput(runCommand);
    console.log('API: Run command stdout:', runStdout);
    console.log('API: Run command stderr:', runStderr);

    const containerId = runStdout.trim(); // Container ID is typically on stdout for run -d
    if (!containerId) {
        console.error('API: Could not determine container ID from run command output.');
        throw new Error('Could not determine container ID from run command output.');
    }
    const url = `http://localhost:${fePort}`;

    console.log(`API: Container launched: ID=${containerId}, URL=${url}`);

    res.status(200).json({ success: true, message: 'Container launched successfully!', url, container_id: containerId });
  } catch (error) {
    console.error('API: Error in /api/launch catch block:', error);
    // Ensure a JSON response is always sent
    res.status(500).json({ success: false, message: error.message || 'An unknown error occurred during container launch.', rawError: error });
  } finally {
    if (tempDir) {
      console.log(`API: Cleaning up temporary directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
