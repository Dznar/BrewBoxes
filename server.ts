import http from 'http';
import { parse } from 'url';
import launchHandler from './src/pages/api/launch';
import stopHandler from './src/pages/api/stop';
import deleteHandler from './src/pages/api/delete';

const PORT = 3001;

// Explicitly set PATH for the Node.js process to include common Podman/Docker paths
// This is crucial for child_process.exec to find the executables
process.env.PATH = `/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${process.env.PATH}`;

const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url || '', true);
  const pathname = parsedUrl.pathname;

  // Create a wrapper for the Node.js 'res' object to mimic Express-like behavior
  const expressRes: any = res;
  expressRes.status = function (code: number) {
    this.statusCode = code;
    return this;
  };
  expressRes.json = function (data: any) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
  };

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      req.body = JSON.parse(body);

      if (pathname === '/launch') {
        await launchHandler(req, expressRes);
      } else if (pathname === '/stop') {
        await stopHandler(req, expressRes);
      } else if (pathname === '/delete') {
        await deleteHandler(req, expressRes);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
