# Análisis PWA — Club Belgrano Tenis

## Objetivo

Hacer la aplicación **instalable** en Android e iOS desde el navegador (prompt "Agregar a pantalla de inicio"), desplegada en Vercel. **No se requiere soporte offline** — solo instalabilidad.

---

## Estado actual

| Aspecto | Estado |
|---------|--------|
| `manifest.json` / `manifest.webmanifest` | ❌ No existe |
| Service Worker | ❌ No existe |
| Meta tags PWA en `index.html` | ❌ Mínimos (falta `theme-color`, `apple-touch-icon`, `description`) |
| Íconos en múltiples resoluciones | ❌ Solo `favicon.jpg` y `logo.jpg` |
| HTTPS | ✅ Vercel sirve con HTTPS por defecto |
| Viewport meta tag | ✅ Presente |
| SPA routing | ✅ Configurado en `vercel.json` |

---

## ¿Qué se necesita para ser instalable?

Los navegadores (Chrome, Safari, Firefox) exigen estos **requisitos mínimos** para mostrar el prompt de instalación:

### 1. Web App Manifest (`manifest.webmanifest`)

Archivo JSON que describe la app. Chrome requiere como mínimo:

```jsonc
{
  "name": "Tenis - Club Belgrano",
  "short_name": "Tenis CB",
  "description": "Reservá canchas de tenis en Club Belgrano",
  "start_url": "/",
  "display": "standalone",       // se ve como app nativa, sin barra del browser
  "background_color": "#F2F2F7", // mapea a --bg-main
  "theme_color": "#0A84FF",      // mapea a --brand-blue
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Campos clave:**
- `display: "standalone"` — la app se abre sin la barra de URL del navegador.
- `icons` — mínimo 192×192 y 512×512. El ícono `maskable` es para Android (zona segura circular/cuadrada).
- `start_url` — ruta inicial al abrir la app instalada.
- `theme_color` — color de la barra de estado en Android.

### 2. Service Worker (mínimo)

Chrome **requiere** un Service Worker registrado para gatillar el evento `beforeinstallprompt`. Safari (iOS) **no lo requiere** pero sí necesita el manifest.

Para cumplir sin implementar caché offline, alcanza con un service worker vacío:

```js
// public/sw.js
self.addEventListener('fetch', () => {});
```

Y registrarlo en `main.tsx`:

```ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

> **Nota:** Si en el futuro se quiere offline, se puede migrar a Workbox o `vite-plugin-pwa` sin romper nada.

### 3. HTTPS

✅ Ya resuelto — Vercel sirve todo por HTTPS.

### 4. Meta tags en `index.html`

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0A84FF" />
<meta name="description" content="Reservá canchas de tenis en Club Belgrano" />

<!-- iOS específico -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Tenis CB" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### 5. Íconos

Se necesitan generar a partir de `logo.jpg`:

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `icon-192.png` | 192×192 | Manifest (obligatorio) |
| `icon-512.png` | 512×512 | Manifest (obligatorio), splash screen Android |
| `icon-maskable-512.png` | 512×512 | Android adaptive icon (con padding ~20%) |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `favicon.ico` | 32×32 | Fallback navegadores desktop |

**Herramientas:** [realfavicongenerator.net](https://realfavicongenerator.net), [maskable.app](https://maskable.app/editor) para validar la zona segura del ícono maskable.

---

## Cambios necesarios en el código

### Archivos a crear

| Archivo | Ubicación |
|---------|-----------|
| `manifest.webmanifest` | `frontend/public/` |
| `sw.js` | `frontend/public/` |
| Íconos PNG (4–5 archivos) | `frontend/public/icons/` |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/index.html` | Agregar `<link rel="manifest">`, meta tags PWA, `apple-touch-icon` |
| `frontend/src/main.tsx` | Registrar Service Worker (3 líneas) |

### Archivos que NO cambian

- `vite.config.ts` — no se necesita `vite-plugin-pwa` para el enfoque mínimo.
- `vercel.json` — las rewrites existentes ya son compatibles. El manifest y sw.js se sirven como estáticos.
- Todo el backend — cero impacto.
- Ningún componente React — cero impacto en la UI existente.

---

## Diferencias Android vs iOS

| Aspecto | Android (Chrome) | iOS (Safari) |
|---------|-------------------|--------------|
| Prompt de instalación | Automático (`beforeinstallprompt`) | Manual ("Compartir → Agregar a Inicio") |
| Service Worker requerido | ✅ Sí | ❌ No (solo manifest) |
| `display: standalone` | ✅ Funciona perfecto | ✅ Funciona (desde iOS 11.3) |
| Push notifications | ✅ Sí | ✅ Sí (desde iOS 16.4, si se instala) |
| Splash screen | Auto-generado desde manifest | Se genera desde meta tags Apple |
| Limitaciones | Ninguna relevante | Sin BadgeAPI; localStorage puede limpiarse por el OS si no se usa la app en ~7 días |

### Implicación importante en iOS

Safari en iOS borra el almacenamiento de PWAs instaladas si el usuario **no abre la app por ~7 días**. Esto afecta:
- `localStorage` (donde se guarda el token de sesión de Supabase)
- El usuario tendría que loguearse de nuevo

**Esto NO es un problema grave** para esta app: es una app de uso frecuente (reservas de tenis), y re-loguearse no es costoso. Pero es algo a saber.

---

## Implicancias en Vercel

### Caching de `manifest.webmanifest` y `sw.js`

Vercel cachea archivos estáticos agresivamente. Para el Service Worker esto puede ser problemático si se actualiza. Opciones:

1. **Agregar headers en `vercel.json`** para que `sw.js` no se cachee:

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

2. Esto es **buena práctica** incluso con un SW vacío, para evitar sorpresas si en el futuro se le agrega lógica.

### Rewrites existentes

El `vercel.json` actual reescribe todo a `index.html`. Los archivos estáticos en `public/` (como `manifest.webmanifest`, `sw.js`, íconos) **tienen prioridad sobre las rewrites** en Vercel, por lo que **no hay conflicto**. No se necesita agregar excepciones.

---

## Complejidad de implementación

| Tarea | Esfuerzo | Riesgo |
|-------|----------|--------|
| Generar íconos | ~15 min (herramientas online) | Nulo |
| Crear `manifest.webmanifest` | ~5 min (copiar template de arriba) | Nulo |
| Crear `sw.js` vacío | ~1 min | Nulo |
| Modificar `index.html` | ~5 min | Nulo |
| Registrar SW en `main.tsx` | ~2 min | Nulo |
| Ajustar `vercel.json` headers | ~3 min | Bajo |
| **Total** | **~30 min** | **Muy bajo** |

**No se instalan dependencias nuevas.** Cero impacto en el bundle size.

---

## ¿vale la pena usar `vite-plugin-pwa`?

| | Sin plugin (enfoque mínimo) | Con `vite-plugin-pwa` |
|-|-----------------------------|-----------------------|
| Dependencias nuevas | 0 | +`vite-plugin-pwa` + `workbox-*` |
| Complejidad | Muy baja | Media |
| Genera SW automáticamente | No | Sí (con Workbox) |
| Precaching de assets | No | Sí |
| Auto-update de SW | Manual | Integrado |
| Necesario para solo instalabilidad | No | No |

**Recomendación:** Para el objetivo actual (solo instalabilidad, sin offline), el enfoque mínimo sin plugins es suficiente y más simple. Si en el futuro se quiere offline o precaching, migrar a `vite-plugin-pwa` es directo.

---

## Testing

Para verificar que funciona antes de deployar:

1. **Chrome DevTools → Application → Manifest:** verificar que se muestra correctamente.
2. **Lighthouse → PWA audit:** debería pasar "Installable".
3. `vite preview` localmente con HTTPS (o usar ngrok) para testear el prompt de instalación.
4. En Android: navegar al sitio en Chrome → debería aparecer el banner "Agregar a pantalla de inicio".
5. En iOS: navegar en Safari → Compartir → "Agregar a pantalla de inicio".

---

## Resumen ejecutivo

Convertir la app en PWA instalable es un cambio **trivial y de riesgo cero**:

- **5 archivos nuevos** (manifest + sw.js + 3 íconos)
- **2 archivos modificados** (`index.html` + `main.tsx`)
- **0 dependencias nuevas**
- **0 cambios en backend**
- **0 cambios en componentes React**
- **Compatible con el deploy actual en Vercel** sin configuración adicional significativa

La única consideración relevante es que en iOS, si el usuario no abre la app por ~7 días, Safari puede limpiar el storage y requerir re-login. Para una app de reservas de uso frecuente, esto no debería ser un problema real.
