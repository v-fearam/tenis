# Configuración de Google reCAPTCHA v3

## ¿Por qué reCAPTCHA?

Google reCAPTCHA v3 protege el sistema de reservas contra bots y ataques automatizados. Es invisible para el usuario y funciona mediante análisis de comportamiento.

## Paso 1: Obtener Claves de reCAPTCHA

1. Ve a [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en el botón "+" para registrar un nuevo sitio
4. Completa el formulario:
   - **Label**: Club Belgrano Tennis (o el nombre que prefieras)
   - **reCAPTCHA type**: Selecciona **"reCAPTCHA v3"**
   - **Domains**: Agrega tus dominios:
     - `localhost` (para desarrollo)
     - `tu-dominio.com` (para producción)
     - `tu-dominio.vercel.app` (si usas Vercel)
   - Acepta los términos de servicio
5. Haz clic en "Submit"
6. Recibirás dos claves:
   - **Site Key** (clave pública) - va en el frontend
   - **Secret Key** (clave privada) - va en el backend

## Paso 2: Configurar Frontend

1. Edita el archivo `frontend/.env`:

```env
VITE_RECAPTCHA_SITE_KEY=tu-site-key-aqui
```

2. Asegúrate de que `frontend/.env` esté en el `.gitignore` (ya debería estarlo)

## Paso 3: Configurar Backend

1. Edita el archivo `backend/.env`:

```env
RECAPTCHA_SECRET_KEY=tu-secret-key-aqui
```

2. Asegúrate de que `backend/.env` esté en el `.gitignore` (ya debería estarlo)

## Paso 4: Probar la Configuración

### En Desarrollo (Local)

1. Inicia el backend:
```bash
cd backend
npm run dev:backend
```

2. Inicia el frontend:
```bash
cd frontend
npm run dev:frontend
```

3. Abre el navegador en `http://localhost:5173`
4. Intenta hacer una reserva
5. Revisa la consola del backend - deberías ver logs de reCAPTCHA:
   ```
   [RecaptchaService] reCAPTCHA verification successful - score: 0.9, action: booking_submit
   ```

### Scores de reCAPTCHA

- **1.0**: Usuario legítimo con alta probabilidad
- **0.5-0.9**: Usuario probablemente legítimo
- **0.0-0.4**: Probablemente un bot (reserva rechazada)

El umbral configurado es **0.5** - puedes ajustarlo en `backend/src/common/recaptcha.service.ts`.

## Paso 5: Configurar para Producción

### Vercel (Frontend)

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - Key: `VITE_RECAPTCHA_SITE_KEY`
   - Value: Tu site key de producción
4. Redeploy la aplicación

### Vercel (Backend)

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - Key: `RECAPTCHA_SECRET_KEY`
   - Value: Tu secret key de producción
4. Redeploy la aplicación

## Modo de Desarrollo sin reCAPTCHA

Si no tienes las claves configuradas (para desarrollo rápido):

- **Frontend**: El componente seguirá funcionando, pero no generará tokens válidos
- **Backend**: Si `RECAPTCHA_SECRET_KEY` está vacío, la verificación se saltará con un warning en los logs

⚠️ **IMPORTANTE**: Nunca despliegues a producción sin configurar reCAPTCHA.

## Solución de Problemas

### Error: "reCAPTCHA no está disponible"

**Causa**: El provider de reCAPTCHA no está inicializado.

**Solución**: Verifica que `VITE_RECAPTCHA_SITE_KEY` esté configurado en `.env` y recarga la página.

### Error: "Verificación de reCAPTCHA falló"

**Causas posibles**:
1. **Clave incorrecta**: Verifica que estés usando la Secret Key correcta en el backend
2. **Dominio no registrado**: Agrega el dominio en la configuración de reCAPTCHA
3. **Token expirado**: Los tokens de reCAPTCHA v3 expiran después de 2 minutos

### Score muy bajo en desarrollo

Es normal que el score sea bajo en localhost durante pruebas repetitivas. En producción con usuarios reales, los scores suelen ser más altos.

### Error de CORS

Si ves errores de CORS relacionados con reCAPTCHA, asegúrate de que el dominio esté correctamente registrado en la consola de reCAPTCHA.

## Monitoreo

Puedes monitorear el uso de reCAPTCHA en:
- [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
- Métricas de requests, scores, y acciones

## Límites y Cuotas

reCAPTCHA v3 tiene un límite gratuito de:
- **1,000,000 evaluaciones/mes** (más que suficiente para la mayoría de aplicaciones)

Si necesitas más, contacta con Google para cuotas empresariales.

## Referencias

- [Documentación oficial de reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3)
- [Mejores prácticas de score interpretation](https://developers.google.com/recaptcha/docs/v3#interpreting_the_score)
