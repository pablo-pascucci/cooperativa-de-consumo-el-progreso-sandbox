# Sandbox «Cooperativa de Consumo El Progreso»

Sitio de prueba, con contenido enteramente ficticio, para estudiar cómo leen e interpretan un sitio los crawlers y agentes de IA. Es independiente del sandbox «Fuente Clara».

## Cómo funciona

- **Fuente única:** todo el contenido vive en `_fuente/` (JSON). Nada de lo que está en la raíz se edita a mano.
- **Generación local, sin build en el servidor:** `node _fuente/build.js` escribe el HTML, los `.md`, `llms.txt`, `robots.txt`, `sitemap.xml` y `.htaccess` en la raíz. Esa salida se commitea, y Hostinger sirve archivos estáticos sin construir nada.
- **HTML puro:** no hay JavaScript, cookies ni analítica. El único `<script>` es el bloque JSON-LD de `/exp-formato-precio/e`.

| Qué cambiar | Dónde |
| --- | --- |
| Dominio (canonical, sitemap, llms.txt) | `_fuente/sitio.json` → `url_base` |
| Páginas institucionales | `_fuente/contenido/NN-*.json` (el prefijo numérico define el orden) |
| Sucursales | `_fuente/datos/sucursales.json` |
| Lista de precios del experimento | `_fuente/datos/precios.json` (después, regenerá la imagen) |
| Página de exp-md-dual | `_fuente/datos/exp-md-dual.json` |

Bloques admitidos en el contenido: `p`, `h2`, `lista`, `pasos`, `tabla`, `datos` y `especial` (`cobertura`, `tabla-sucursales`). El único marcado en línea es `[texto](/ruta)`.

## Ver el sitio en local

Abrir con doble clic `ABRIR-SITIO-LOCAL.html`, que redirige a `vista-local/index.html`. Es una copia con enlaces relativos y la imagen incrustada, que el build regenera en cada corrida. Las dos cosas están en `.gitignore`, así que no se publican.

El CSS (`_fuente/estilo.css`) va incrustado en todas las páginas, también en las publicadas, así que el diseño se ve aunque abras el `index.html` de la raíz. Pero desde ahí los enlaces de navegación no funcionan, porque son rutas del servidor (`/historia`). Para navegar en local, usá el acceso directo.

## Comandos

```
node _fuente/build.js
powershell -ExecutionPolicy Bypass -File _fuente/generar-imagen-precios.ps1
node _fuente/servidor-local.js 8080
```

1. Regenera el sitio. Falla si la verificación de neutralidad encuentra palabras prohibidas.
2. Regenera `assets/exp-formato-precio/lista-precios.png` desde `precios.json`.
3. Levanta una vista previa local que imita el `.htaccess`.

## Experimentos

| Experimento | Rutas | Notas |
| --- | --- | --- |
| exp-formato-precio | `/exp-formato-precio/a` … `/e` | Misma lista y misma imagen. Sin par `.md` ni entrada en llms.txt, para no filtrar los precios como texto. |
| exp-memoria-direccion | `/exp-memoria-direccion` | Sucursal Colonia Santa Irene: Calle Teodomiro Barrancos 1847, (03999) 49-1847. |
| exp-md-dual | `/exp-md-dual/solo-llmstxt`, `/solo-linkalternate`, `/solo-linkvisible` | Cada `.md` se descubre por un único mecanismo. Se mide con los logs de acceso del servidor (qué user-agent pidió qué `.md`). |
| exp-percepcion-institucional | Consejo, Sindicatura, Normativa, Asamblea (+ Cómo asociarse) | `build.js` verifica que esas páginas no contengan vocabulario de dificultad (lista `PROHIBIDAS`). |

### Retirar la sucursal del experimento de memoria

1. En `_fuente/sitio.json`, poner `"experimento_memoria": { ..., "retirada": true }`.
2. Correr `node _fuente/build.js`. Con eso, la sucursal desaparece de `/sucursales` y de los `.md`, «Quiénes somos» recalcula la cantidad de sucursales y localidades, la página sale del sitemap y `/exp-memoria-direccion` pasa a responder **410 Gone**.
3. Anotar la fecha del commit como fecha de retiro, que es el inicio de la medición.

## Deploy en Hostinger

hPanel → Avanzado → Git: conectar este repositorio, rama `main`, directorio `public_html` (vacío), y activar el auto-deploy por webhook. El `.htaccess` generado resuelve las URLs sin extensión, el `Content-Type: text/markdown; charset=utf-8` de los `.md`, la página 404 y el bloqueo de `_fuente/`, `.git` y este README.

Todos los teléfonos usan la característica inventada `03999`. Antes de publicar, conviene confirmar que no esté asignada.
