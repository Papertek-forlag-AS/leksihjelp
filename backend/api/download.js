/**
 * Leksihjelp — Extension Download (Vercel Serverless Function)
 *
 * Streams the extension zip to the client using chunked transfer
 * encoding, which bypasses Vercel's 4.5 MB buffered response limit.
 *
 * The zip is included in the function bundle via "includeFiles" in vercel.json.
 */

import { createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Try multiple possible paths where Vercel might place the bundled file
  const candidates = [
    join(__dirname, '..', 'public', 'lexi-extension.zip'),
    join(process.cwd(), 'public', 'lexi-extension.zip'),
    '/var/task/public/lexi-extension.zip',
    '/var/task/backend/public/lexi-extension.zip',
  ];

  const filePath = candidates.find(p => existsSync(p));

  if (!filePath) {
    return res.status(404).json({
      error: 'Extension zip not found in bundle',
      tried: candidates,
    });
  }

  // Stream the file WITHOUT Content-Length to use chunked transfer encoding.
  // This bypasses Vercel's 4.5 MB buffered response body size limit.
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="lexi-extension.zip"');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read zip file' });
    }
  });
  stream.pipe(res);
}
