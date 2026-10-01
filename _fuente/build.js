'use strict';
// Generador del sitio. Lee _fuente/ y escribe HTML, Markdown, llms.txt, robots.txt,
// sitemap.xml y .htaccess en la raíz del repositorio. Sin dependencias: `node _fuente/build.js`.
// La salida se commitea; el servidor (Hostinger) sólo sirve archivos estáticos.

const fs = require('fs');
const path = require('path');

const FUENTE = __dirname;
const RAIZ = path.resolve(FUENTE, '..');
const MANIFIESTO = path.join(FUENTE, '.generados.json');

const leer = (rel) => JSON.parse(fs.readFileSync(path.join(FUENTE, rel), 'utf8'));

const sitio = leer('sitio.json');
const precios = leer('datos/precios.json');
const mdDual = leer('datos/exp-md-dual.json');
const BASE = sitio.url_base.replace(/\/+$/, '');
const expMem = sitio.experimento_memoria;
const sucursales = leer('datos/sucursales.json')
  .filter((s) => !(expMem.retirada && s.id === expMem.sucursal_id));

const paginas = fs.readdirSync(path.join(FUENTE, 'contenido'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => leer(path.join('contenido', f)));

const IMG_PRECIOS = '/assets/exp-formato-precio/lista-precios.png';

// ---------------------------------------------------------------- utilidades

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Texto en línea: único marcado admitido, enlaces estilo Markdown [texto](/ruta).
const enlaceRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const inlineHtml = (s) => esc(s).replace(enlaceRe, '<a href="$2">$1</a>');
const inlineMd = (s) => String(s);
const textoPlano = (s) => String(s).replace(enlaceRe, '$1');
const celdaMd = (s) => inlineMd(s).replace(/\|/g, '\\|');

const pesos = (n) => '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
const url = (ruta) => BASE + ruta;
const archivoHtml = (ruta) => (ruta === '/' ? 'index.html' : ruta.slice(1) + '.html');
const archivoMd = (ruta) => ruta.slice(1) + '.md';

// ---------------------------------------------------------------- bloques
// Una página es una lista de bloques; HTML y Markdown se renderizan desde la misma lista.

function localidades() {
  return [...new Set(sucursales.map((s) => s.localidad))];
}

function enumerar(items) {
  return items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

function expandir(bloque) {
  if (!bloque.especial) return [bloque];
  switch (bloque.especial) {
    case 'cobertura': {
      const n = sucursales.length;
      return [{ p: `La cooperativa tiene ${n} ${n === 1 ? 'sucursal' : 'sucursales'} en ${enumerar(localidades())}.` }];
    }
    case 'tabla-sucursales':
      return [{ tabla: {
        encabezados: ['Sucursal', 'Dirección', 'Localidad', 'Teléfono', 'Horario'],
        filas: sucursales.map((s) => [s.nombre, s.direccion, s.localidad, s.telefono, s.horario]),
      } }];
    default:
      throw new Error(`Bloque especial desconocido: ${bloque.especial}`);
  }
}

function bloquesHtml(bloques) {
  return bloques.flatMap(expandir).map((b) => {
    if (b.p) return `<p>${inlineHtml(b.p)}</p>`;
    if (b.h2) return `<h2>${inlineHtml(b.h2)}</h2>`;
    if (b.lista) return `<ul>\n${b.lista.map((i) => `  <li>${inlineHtml(i)}</li>`).join('\n')}\n</ul>`;
    if (b.pasos) return `<ol>\n${b.pasos.map((i) => `  <li>${inlineHtml(i)}</li>`).join('\n')}\n</ol>`;
    if (b.datos) return `<dl class="datos">\n${b.datos.map(([k, v]) => `  <div><dt>${inlineHtml(k)}</dt><dd>${inlineHtml(v)}</dd></div>`).join('\n')}\n</dl>`;
    if (b.tabla) {
      const { encabezados, filas } = b.tabla;
      return [
        '<table>',
        `  <thead><tr>${encabezados.map((h) => `<th scope="col">${inlineHtml(h)}</th>`).join('')}</tr></thead>`,
        '  <tbody>',
        ...filas.map((f) => `    <tr>${f.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`),
        '  </tbody>',
        '</table>',
      ].join('\n');
    }
    throw new Error('Bloque desconocido: ' + JSON.stringify(b));
  }).join('\n');
}

function bloquesMd(bloques) {
  return bloques.flatMap(expandir).map((b) => {
    if (b.p) return inlineMd(b.p);
    if (b.h2) return `## ${inlineMd(b.h2)}`;
    if (b.lista) return b.lista.map((i) => `- ${inlineMd(i)}`).join('\n');
    if (b.pasos) return b.pasos.map((i, n) => `${n + 1}. ${inlineMd(i)}`).join('\n');
    if (b.datos) return b.datos.map(([k, v]) => `- **${inlineMd(k)}:** ${inlineMd(v)}`).join('\n');
    if (b.tabla) {
      const { encabezados, filas } = b.tabla;
      return [
        `| ${encabezados.map(celdaMd).join(' | ')} |`,
        `| ${encabezados.map(() => '---').join(' | ')} |`,
        ...filas.map((f) => `| ${f.map(celdaMd).join(' | ')} |`),
      ].join('\n');
    }
    throw new Error('Bloque desconocido: ' + JSON.stringify(b));
  }).join('\n\n');
}

function textosDe(bloques) {
  return bloques.flatMap(expandir).flatMap((b) =>
    b.p ? [b.p] : b.h2 ? [b.h2] : b.lista || b.pasos || (b.datos ? b.datos.flat() : b.tabla ? [...b.tabla.encabezados, ...b.tabla.filas.flat()] : []),
  ).map(textoPlano);
}

const documentoMd = (titulo, bloques) => `# ${titulo}\n\n${bloquesMd(bloques)}\n`;

// ---------------------------------------------------------------- verificación editorial
// exp-percepcion-institucional: las páginas marcadas no pueden sugerir dificultad.

const PROHIBIDAS = [
  'complej', 'complicad', 'burocr', 'extens', 'rigur', 'exhaustiv', 'engorros', 'lento', 'lenta',
  'lentitud', 'demor', 'dificil', 'dificult', 'tramit', 'estrict', 'minucios', 'arduo', 'ardua',
  'exigen', 'meticulos', 'laborios', 'tedios', 'largo proceso', 'proceso largo', 'espera',
];

function verificarNeutralidad() {
  const normal = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hallazgos = [];
  for (const p of paginas.filter((x) => x.verificar_neutralidad)) {
    const texto = normal([p.titulo, p.descripcion, ...textosDe(p.bloques)].join(' \n '));
    for (const raiz of PROHIBIDAS) {
      const m = texto.match(new RegExp(`\\b${raiz}\\w*`, 'g'));
      if (m) hallazgos.push(`${p.ruta}: «${[...new Set(m)].join('», «')}»`);
    }
  }
  if (hallazgos.length) {
    console.error('Verificación de neutralidad FALLIDA:\n  ' + hallazgos.join('\n  '));
    process.exit(1);
  }
  console.log(`Verificación de neutralidad OK (${paginas.filter((x) => x.verificar_neutralidad).length} páginas).`);
}

// ---------------------------------------------------------------- plantilla HTML

function documentoHtml({ ruta, titulo, descripcion, cuerpo, mdRuta = null, alternate = false, enlaceFooter = false, jsonld = null }) {
  const tituloCompleto = ruta === '/' ? sitio.nombre : `${titulo} | ${sitio.nombre}`;
  const nav = [{ ruta: '/', nav: 'Inicio' }, ...paginas]
    .map((p) => `<a href="${p.ruta}"${p.ruta === ruta ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`)
    .join('\n        ');
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(tituloCompleto)}</title>`,
    `<meta name="description" content="${esc(descripcion)}">`,
    `<link rel="canonical" href="${url(ruta)}">`,
    alternate && mdRuta ? `<link rel="alternate" type="text/markdown" href="${mdRuta}" title="Versión Markdown">` : null,
    '<link rel="stylesheet" href="/assets/estilo.css">',
    jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>` : null,
  ].filter(Boolean).map((l) => '  ' + l).join('\n');

  return `<!doctype html>
<html lang="${sitio.idioma}">
<head>
${head}
</head>
<body>
  <header class="sitio">
    <div class="contenedor">
      <a class="marca" href="/">${esc(sitio.nombre)}</a>
      <nav aria-label="Secciones">
        ${nav}
      </nav>
    </div>
  </header>
  <main class="contenedor">
<h1>${esc(titulo)}</h1>
${cuerpo}
  </main>
  <footer class="sitio">
    <div class="contenedor">
${enlaceFooter && mdRuta ? `      <p><a href="${mdRuta}">Ver esta página en formato Markdown</a></p>\n` : ''}      <p>${esc(sitio.nombre_legal)}</p>
${sitio.aviso_ficticio ? `      <p class="aviso">${esc(sitio.aviso_ficticio)}</p>\n` : ''}    </div>
  </footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------- salida

const salida = new Map(); // ruta relativa a RAIZ -> contenido
const htmlRutas = [];     // para sitemap.xml
const emitir = (rel, contenido) => salida.set(rel, contenido);
const emitirHtml = (ruta, opciones) => {
  emitir(archivoHtml(ruta), documentoHtml({ ruta, ...opciones }));
  htmlRutas.push(ruta);
};

function construir() {
  // Home
  emitirHtml('/', {
    titulo: sitio.nombre,
    descripcion: sitio.resumen,
    cuerpo: [
      ...sitio.presentacion.map((p) => `<p>${inlineHtml(p)}</p>`),
      '<h2>Secciones</h2>',
      '<ul class="secciones">',
      ...paginas.map((p) => `  <li><a href="${p.ruta}">${esc(p.titulo)}</a>: ${esc(p.descripcion)}</li>`),
      '</ul>',
    ].join('\n'),
  });

  // Páginas institucionales (HTML + MD desde la misma fuente)
  for (const p of paginas) {
    const mdRuta = '/' + archivoMd(p.ruta);
    emitirHtml(p.ruta, {
      titulo: p.titulo, descripcion: p.descripcion, cuerpo: bloquesHtml(p.bloques),
      mdRuta, alternate: true, enlaceFooter: true,
    });
    emitir(archivoMd(p.ruta), documentoMd(p.titulo, p.bloques));
  }

  // exp-formato-precio: misma lista, cinco técnicas de presentación. Sin par .md a propósito.
  const intro = `<p>${esc(precios.introduccion)}</p>`;
  const img = (alt) => `<p><img src="${IMG_PRECIOS}" width="900" height="460"${alt === null ? '' : ` alt="${esc(alt)}"`}></p>`;
  const lineas = precios.productos.map((x) => `${x.nombre}: ${pesos(x.precio)}`);
  const altTexto = `${precios.titulo}. ${lineas.join('. ')}.`;
  const tabla = [
    '<table>',
    '  <thead><tr><th scope="col">Producto</th><th scope="col">Precio</th></tr></thead>',
    '  <tbody>',
    ...precios.productos.map((x) => `    <tr><td>${esc(x.nombre)}</td><td>${esc(pesos(x.precio))}</td></tr>`),
    '  </tbody>',
    '</table>',
  ].join('\n');
  const jsonldProductos = {
    '@context': 'https://schema.org',
    '@graph': precios.productos.map((x) => ({
      '@type': 'Product',
      name: x.nombre,
      offers: {
        '@type': 'Offer',
        price: String(x.precio),
        priceCurrency: precios.moneda,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: sitio.nombre_legal },
      },
    })),
  };
  const variantes = {
    a: { cuerpo: [intro, img(null)] },
    b: { cuerpo: [intro, img(altTexto)] },
    c: { cuerpo: [intro, img(null), `<ul>\n${lineas.map((l) => `  <li>${esc(l)}</li>`).join('\n')}\n</ul>`] },
    d: { cuerpo: [intro, tabla] },
    e: { cuerpo: [intro, img(null)], jsonld: jsonldProductos },
  };
  for (const [v, { cuerpo, jsonld }] of Object.entries(variantes)) {
    emitirHtml(`/exp-formato-precio/${v}`, {
      titulo: precios.titulo, descripcion: precios.introduccion, cuerpo: cuerpo.join('\n'), jsonld,
    });
  }

  // exp-memoria-direccion: se omite (y responde 410) cuando la sucursal está retirada.
  if (!expMem.retirada) {
    const s = sucursales.find((x) => x.id === expMem.sucursal_id);
    if (!s) throw new Error(`No existe la sucursal ${expMem.sucursal_id}`);
    emitirHtml(expMem.ruta, {
      titulo: s.nombre,
      descripcion: `Dirección, teléfono y horario de la ${s.nombre}.`,
      cuerpo: bloquesHtml([{ datos: [['Dirección', s.direccion], ['Localidad', s.localidad], ['Teléfono', s.telefono], ['Horario', s.horario]] }]),
    });
  }

  // exp-md-dual: un solo mecanismo de descubrimiento del .md por variante.
  for (const v of mdDual.variantes) {
    const mdRuta = '/' + archivoMd(v.ruta);
    let cuerpo = bloquesHtml(mdDual.bloques);
    if (v.mecanismo === 'linkvisible') cuerpo += `\n<p><a href="${mdRuta}">Ver esta página en formato Markdown</a></p>`;
    emitirHtml(v.ruta, {
      titulo: mdDual.titulo, descripcion: mdDual.descripcion, cuerpo,
      mdRuta, alternate: v.mecanismo === 'linkalternate', enlaceFooter: false,
    });
    emitir(archivoMd(v.ruta), documentoMd(mdDual.titulo, mdDual.bloques));
  }

  // 404
  emit404();

  // llms.txt — sólo páginas institucionales, más la variante solo-llmstxt por definición.
  const secciones = new Map();
  const agregar = (sec, linea) => (secciones.get(sec) || secciones.set(sec, []).get(sec)).push(linea);
  for (const p of paginas) agregar(p.llms_seccion, `- [${p.titulo}](${url('/' + archivoMd(p.ruta))}): ${p.descripcion}`);
  const soloLlms = mdDual.variantes.find((v) => v.mecanismo === 'llmstxt');
  agregar(mdDual.llms_seccion, `- [${mdDual.titulo}](${url('/' + archivoMd(soloLlms.ruta))}): ${mdDual.descripcion}`);
  emitir('llms.txt', [
    `# ${sitio.nombre}`,
    '',
    `> ${sitio.resumen}`,
    '',
    ...sitio.presentacion.map(textoPlano).flatMap((p) => [p, '']),
    ...[...secciones].flatMap(([sec, lineas]) => [`## ${sec}`, '', ...lineas, '']),
  ].join('\n'));

  // robots.txt
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'anthropic-ai',
    'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'Bingbot'];
  emitir('robots.txt', [
    ...['*', ...bots].flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${url('/sitemap.xml')}`,
    '',
  ].join('\n'));

  // sitemap.xml — sólo HTML, nunca .md
  emitir('sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...htmlRutas.map((r) => `  <url><loc>${esc(url(r))}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n'));

  emitir('.htaccess', htaccess());
}

function emit404() {
  const doc = documentoHtml({
    ruta: '/404', titulo: 'Página no encontrada', descripcion: 'La página solicitada no existe.',
    cuerpo: '<p>La página que buscás no existe. Podés volver al <a href="/">inicio</a>.</p>',
  }).replace(/  <link rel="canonical"[^\n]*\n/, '');
  emitir('404.html', doc);
}

function htaccess() {
  return `# Generado por _fuente/build.js — no editar a mano.
Options -Indexes -MultiViews
DirectoryIndex index.html
ErrorDocument 404 /404.html

AddDefaultCharset utf-8
AddType text/markdown .md
AddCharset utf-8 .md .txt .html .xml
<IfModule mod_headers.c>
  <FilesMatch "\\.md$">
    Header set Content-Type "text/markdown; charset=utf-8"
  </FilesMatch>
  <FilesMatch "\\.txt$">
    Header set Content-Type "text/plain; charset=utf-8"
  </FilesMatch>
</IfModule>

# Fuente del generador y archivos del repositorio: no se sirven.
RedirectMatch 404 ^/(_fuente|\\.git)(/|$)
RedirectMatch 404 ^/(README\\.md|\\.gitignore)$
${expMem.retirada ? `\n# exp-memoria-direccion: sucursal retirada.\nRedirect gone ${expMem.ruta}\n` : ''}
<IfModule mod_rewrite.c>
  RewriteEngine On

  # /index.html -> /
  RewriteCond %{THE_REQUEST} \\s/+index\\.html[\\s?] [NC]
  RewriteRule ^ / [R=301,L]

  # /pagina.html -> /pagina
  RewriteCond %{THE_REQUEST} \\s/+(.+?)\\.html[\\s?] [NC]
  RewriteRule ^ /%1 [R=301,L]

  # /pagina -> pagina.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{DOCUMENT_ROOT}/$1.html -f
  RewriteRule ^(.+?)/?$ $1.html [L]
</IfModule>
`;
}

// ---------------------------------------------------------------- escritura

function escribir() {
  // Borra lo generado en la corrida anterior (p. ej. la página de una sucursal retirada).
  const previos = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : [];
  for (const rel of previos) {
    if (!salida.has(rel)) fs.rmSync(path.join(RAIZ, rel), { force: true });
  }
  for (const [rel, contenido] of salida) {
    const destino = path.join(RAIZ, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido, 'utf8');
  }
  fs.writeFileSync(MANIFIESTO, JSON.stringify([...salida.keys()].sort(), null, 2) + '\n', 'utf8');
  console.log(`Generados ${salida.size} archivos (${htmlRutas.length} páginas HTML en el sitemap).`);
}

function advertencias() {
  if (/REEMPLAZAR|example/i.test(BASE)) {
    console.warn(`ATENCIÓN: url_base es "${BASE}". Configurá el dominio real en _fuente/sitio.json antes de publicar.`);
  }
  const png = path.join(RAIZ, IMG_PRECIOS);
  if (!fs.existsSync(png)) {
    console.warn('ATENCIÓN: falta la imagen de precios. Generala con _fuente/generar-imagen-precios.ps1.');
  } else if (fs.statSync(path.join(FUENTE, 'datos/precios.json')).mtimeMs > fs.statSync(png).mtimeMs) {
    console.warn('ATENCIÓN: precios.json es más nuevo que la imagen. Regenerala con _fuente/generar-imagen-precios.ps1.');
  }
}

verificarNeutralidad();
construir();
escribir();
advertencias();
