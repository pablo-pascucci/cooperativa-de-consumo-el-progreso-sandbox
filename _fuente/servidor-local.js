'use strict';
// Vista previa local que imita las reglas del .htaccess (URLs limpias, tipos MIME, 404/410).
// Uso: node _fuente/servidor-local.js [puerto]   (por defecto 8080)

const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = Number(process.argv[2]) || 8080;
const sitio = JSON.parse(fs.readFileSync(path.join(__dirname, 'sitio.json'), 'utf8'));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const esArchivo = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

function enviar(res, estado, archivo, extra = {}) {
  res.writeHead(estado, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', ...extra });
  res.end(fs.readFileSync(archivo));
}

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const no404 = () => enviar(res, 404, path.join(RAIZ, '404.html'));

  if (/^\/(_fuente|\.git)(\/|$)|^\/(README\.md|\.gitignore|\.htaccess)$/.test(ruta)) return no404();
  if (sitio.experimento_memoria.retirada && ruta === sitio.experimento_memoria.ruta) {
    res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('410 Gone');
  }
  const directo = path.join(RAIZ, ruta === '/' ? 'index.html' : ruta);
  if (!directo.startsWith(RAIZ)) return no404();
  if (ruta.length > 1 && ruta.endsWith('/') && !fs.existsSync(directo)) {
    res.writeHead(301, { Location: ruta.slice(0, -1) }); return res.end();
  }
  if (esArchivo(directo)) return enviar(res, 200, directo);
  const conHtml = path.join(RAIZ, ruta + '.html');
  if (esArchivo(conHtml)) return enviar(res, 200, conHtml);
  return no404();
}).listen(PUERTO, () => console.log(`Vista previa en http://localhost:${PUERTO}/`));
