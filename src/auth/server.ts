/**
 * Local OAuth callback server
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const DEFAULT_PORT = 3000;
const TIMEOUT_MS = 120_000; // 2 minutes

interface CallbackResult {
  code: string;
  state: string;
}

/**
 * Start a temporary HTTP server to receive the OAuth callback
 */
export function startCallbackServer(
  expectedState: string,
  port: number = DEFAULT_PORT
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>❌ Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || !state) {
        res.writeHead(400);
        res.end('Missing code or state');
        server.close();
        reject(new Error('Missing code or state in callback'));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400);
        res.end('Invalid state');
        server.close();
        reject(new Error('State mismatch - possible CSRF attack'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);

      server.close();
      resolve({ code, state });
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth callback timed out'));
    }, TIMEOUT_MS);

    server.on('close', () => {
      clearTimeout(timeout);
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    server.listen(port, () => {
      // Server started, waiting for callback
    });
  });
}

/**
 * Get the callback URL for OAuth
 */
export function getCallbackUrl(port: number = DEFAULT_PORT): string {
  return process.env['WHOOP_REDIRECT_URI'] ?? `http://localhost:${port}/callback`;
}
