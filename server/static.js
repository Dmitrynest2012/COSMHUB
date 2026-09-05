import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

export function servePublic(publicDir) {
  return (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, name: 'Сфера', time: Date.now() }));
      return;
    }

    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/index.html';
    const filePath = path.normalize(path.join(publicDir, relative));
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        const fallback = path.join(publicDir, 'index.html');
        fs.readFile(fallback, (readErr, buf) => {
          if (readErr) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buf);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  };
}
