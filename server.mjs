import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 3210);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = path.resolve(root, '.' + relative);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('文件不存在'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已占用，请设置 PORT 后重试。` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`HUST_CUP_BROADCAST 视觉预览：http://127.0.0.1:${port}\n按 Ctrl+C 停止。当前为第一阶段预览，不含正式播控服务。`));
