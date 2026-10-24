# Semiesfera en localhost

Guía rápida para servir el sitio en tu máquina y probarlo como lo vería un
lector. No hay dependencias que instalar: solo Node >= 18.

## 1. Requisitos

- Node >= 18 (`node --version`)
- Un terminal en la raíz de este repo (donde está `build.mjs`)

## 2. Compilar y servir

```sh
npm test        # compila (node build.mjs) y comprueba el resultado (smoke)
npm run serve   # sirve public/ en http://localhost:8178
```

Abre <http://localhost:8178> en el navegador.

- `npm run serve` no recompila: si tocas `content/`, `assets/` o `build.mjs`,
  vuelve a correr `npm run build` (o `npm test`) y recarga la página.
- El servidor sirve **siempre** `public/`; nunca sirve los fuentes.
- Para otro puerto: `PORT=3000 npm run serve`.

## 3. Qué probar

| URL | Qué es |
| --- | --- |
| `http://localhost:8178/` | Portada |
| `http://localhost:8178/explorar/` | Mapa, línea de tiempo y paneles |
| `http://localhost:8178/historias/<id>/` | Página propia de cada historia |
| `http://localhost:8178/rss.xml` | Feed RSS |
| `http://localhost:8178/404.html` | Página de error |

Para simular un lector nuevo (sin progreso): en las herramientas de
desarrollo del navegador, consola:

```js
localStorage.clear(); location.reload();
```

## 4. Flujo de trabajo completo (autoría)

```sh
# importar/actualizar una historia desde content/sources (ver README.md)
node tools/import-story.mjs <historia>

# compilar + comprobar + servir
npm test && npm run serve
```

## 5. Problemas comunes

- **El puerto 8178 está ocupado** → usa `PORT=otro npm run serve`.
- **Veo contenido viejo tras compilar** → recarga forzada (Ctrl+Shift+R); el
  servidor no cachea, pero el navegador sí.
- **`public/` no existe** → corre primero `npm run build`.
