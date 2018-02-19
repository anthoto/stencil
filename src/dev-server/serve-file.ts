import { DevServerConfig, FileSystem, HttpRequest } from '../declarations';
import { getContentType } from './content-type';
import { serve404 } from './serve-error';
import * as http  from 'http';
import * as path from 'path';
import { Buffer } from 'buffer';


export async function serveFile(config: DevServerConfig, fs: FileSystem, req: HttpRequest, res: http.ServerResponse) {
  try {
    if (isHtmlFile(req.filePath)) {
      // easy text file, use the internal cache
      let content = await fs.readFile(req.filePath);

      // auto inject our dev server script
      content += `\n${DEV_SERVER_SCRIPT}`;

      res.writeHead(200, {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Expires': '0',
        'Content-Type': getContentType(config, req.filePath),
        'Content-Length': Buffer.byteLength(content, 'utf8')
      });

      res.write(content);
      res.end();

    } else {
      // non-well-known text file or other file, probably best we use a stream
      res.writeHead(200, {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Expires': '0',
        'Content-Type': getContentType(config, req.filePath),
        'Content-Length': req.stats.size
      });

      fs.createReadStream(req.filePath).pipe(res);
    }

  } catch (e) {
    serve404(config, fs, req, res);
  }
}


export async function serveStaticDevClient(config: DevServerConfig, fs: FileSystem, req: HttpRequest, res: http.ServerResponse) {
  if (isDevServerInitialLoad(req)) {
    req.filePath = path.join(config.devServerDir, 'templates/initial-load.html');

  } else {
    const staticFile = req.pathname.replace(DEV_SERVER_URL + '/', '');
    req.filePath = path.join(config.devServerDir, 'static', staticFile);
  }

  req.stats = await fs.stat(req.filePath);

  return serveFile(config, fs, req, res);
}


function isHtmlFile(filePath: string) {
  filePath = filePath.toLowerCase().trim();
  return (filePath.endsWith('.html') || filePath.endsWith('.htm'));
}


export function isStaticDevClient(req: HttpRequest) {
  return req.pathname.startsWith(DEV_SERVER_URL);
}


function isDevServerInitialLoad(req: HttpRequest) {
  return req.pathname === UNREGISTER_SW_URL;
}


export const DEV_SERVER_URL = '/__dev-server';

export const UNREGISTER_SW_URL = `${DEV_SERVER_URL}-init`;

const DEV_SERVER_SCRIPT = `<script src="${DEV_SERVER_URL}/dev-server.js" data-dev-server-script></script>`;
