# Publicar el sitio en Cloudflare Pages con dominio propio

Cómo queda: **cada push a `main` publica en producción** (el dominio propio) por medio de GitHub Actions (`.github/workflows/deploy.yml`). Cualquier otra rama publica una **vista previa** en `https://<rama>.ssds-proyectos.pages.dev`, que no se indexa. Antes de publicar, el workflow corre la autoprueba del motor del dimensionador: si falla, no sale nada.

Dominio sugerido: **ssdsproyectos.com** (coincide con el correo `ssdsproyectos@gmail.com`; estaba libre el 5-oct-2026 según RDAP). Cloudflare no vende dominios `.ve`.

## 0. Antes de empezar

- **La cuenta debe ser de la empresa.** Crea la cuenta de Cloudflare con `ssdsproyectos@gmail.com` (o el correo que David controle) y paga con su tarjeta. El dominio queda a nombre de la empresa y Diego entra como miembro. Si Diego se va, la empresa no pierde su dominio.
- **Precios de prueba.** `pricing.provisional` en `src/data/dimensionar.js` muestra "Precios de prueba · por confirmar" en la página y en el PDF. Si David ya cerró lo pendiente de `docs/PREGUNTAS-DAVID.md`, cámbialo a `false` antes de publicar.
- Ten a mano: tarjeta internacional (Visa/Mastercard) y los datos de la empresa: razón social SERVICIOS Y SUMINISTROS D&S, C.A., dirección en Maracay, teléfono y correo.

## 1. Cuenta de Cloudflare

1. Entra a <https://dash.cloudflare.com/sign-up> y crea la cuenta con el correo de la empresa. Confirma el correo.
2. Activa la verificación en dos pasos: icono de perfil → **My Profile** → **Authentication** → **Two-Factor Authentication**.
3. (Opcional) Invita a Diego: **Manage Account** → **Members** → **Invite**, con rol **Administrator**.

## 2. Comprar el dominio

1. En el panel: **Domain Registration** → **Register Domains**.
2. Busca `ssdsproyectos.com` y pulsa **Purchase**.
3. Datos del titular (son obligatorios y deben ser reales): organización *SERVICIOS Y SUMINISTROS D&S, C.A.*, nombre de David, dirección en Maracay, teléfono y correo. Cloudflare los oculta del WHOIS público sin costo.
4. Deja **Auto-renew** activado y paga.
5. **Importante:** te llega un correo de verificación del registrante. Ábrelo y confírmalo. Si no se verifica en 15 días, el dominio se suspende.
6. El dominio aparece en **Websites** como zona activa, ya con los DNS de Cloudflare. No hay que configurar nameservers.

## 3. Token para que GitHub publique

1. **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token** (al final de la lista).
2. Nombre: `GitHub Actions ssds-proyectos`.
3. Permisos: **Account** · **Cloudflare Pages** · **Edit**.
4. Account Resources: **Include** → la cuenta de la empresa.
5. **Continue to summary** → **Create Token**. **Copia el token ahora**: no se vuelve a mostrar.
6. Copia también el **Account ID**. Está en la URL del panel (`dash.cloudflare.com/<ACCOUNT_ID>/...`) o en la página del dominio, columna derecha, sección **API**.

## 4. Secretos y variables en GitHub

Repo `Diestorn03/ssds-proyectos` → **Settings** → **Secrets and variables** → **Actions**:

| Pestaña | Nombre | Valor |
|---|---|---|
| Secrets | `CLOUDFLARE_API_TOKEN` | el token del paso 3 |
| Secrets | `CLOUDFLARE_ACCOUNT_ID` | el Account ID |
| Variables | `SITE_URL` | `https://ssdsproyectos.com` (sin barra final) |

Si existe una variable vieja `PUBLIC_DEMO`, bórrala: el workflow nuevo ya no la usa.

## 5. Primera publicación

1. Vista previa: `git push origin lanzamiento`. En **Actions** → **Deploy to Cloudflare Pages** debe quedar en verde. El primer run crea el proyecto `ssds-proyectos`.
2. Abre la URL que imprime el paso **Publicar** (algo como `https://lanzamiento.ssds-proyectos.pages.dev`) y revisa el sitio.
   - Si el nombre `ssds-proyectos.pages.dev` ya estaba tomado, Cloudflare agrega un sufijo. La URL real sale en el log y en **Workers & Pages**.
3. Producción: une `lanzamiento` a `main` (Pull Request o `git switch main && git merge lanzamiento && git push`). El run de `main` publica la versión de producción en `https://ssds-proyectos.pages.dev`.

## 6. Conectar el dominio

Hazlo en este orden. Si creas el registro DNS a mano antes de añadir el dominio en Pages, el sitio da error 522.

1. **Workers & Pages** → `ssds-proyectos` → **Custom domains** → **Set up a custom domain**.
2. Escribe `ssdsproyectos.com` → **Continue** → **Activate domain**. Cloudflare crea el registro DNS solo.
3. Repite con `www.ssdsproyectos.com`.
4. Espera a que ambos digan **Active**. El certificado SSL sale solo, normalmente en minutos.

## 7. www → dominio raíz y HTTPS

1. En el dominio (**Websites** → `ssdsproyectos.com`): **Rules** → **Redirect Rules** → **Create rule** → plantilla **Redirect from WWW to Root**.
   - A mano sería: cuando el hostname es igual a `www.ssdsproyectos.com`, redirección dinámica 301 a `concat("https://ssdsproyectos.com", http.request.uri.path)`, conservando la query string.
2. **SSL/TLS** → **Edge Certificates** → **Always Use HTTPS**: **On**.

## 8. Lista de comprobación

- [ ] `https://ssdsproyectos.com` carga con candado, y `http://` y `www` redirigen a él.
- [ ] `/dimensionar/`: el flujo completo funciona, el PDF se descarga con fotos y WhatsApp abre con el mensaje.
- [ ] `https://ssdsproyectos.com/robots.txt` dice `Allow: /` y trae la línea `Sitemap:`.
- [ ] Ver código fuente de la home: **no** hay `noindex` y el pie no dice "Propuesta de sitio web · demo".
- [ ] Una ruta inexistente muestra la página 404 del sitio.
- [ ] Al mandar el enlace por WhatsApp aparece la vista previa con imagen.

## 9. Apagar la demo de GitHub Pages

Repo → **Settings** → **Pages** → **Source: None**, o **Unpublish site**. La URL `diestorn03.github.io/ssds-proyectos` deja de existir y no queda contenido duplicado.

## Día a día

- Trabaja en ramas: cada push publica una vista previa en `https://<rama>.ssds-proyectos.pages.dev`.
- Une a `main` y en 1–2 minutos está en producción.
- **Volver atrás:** **Workers & Pages** → `ssds-proyectos` → **Deployments** → la versión anterior → **Rollback to this deployment**.

## Opcional

- **Correo con el dominio:** **Email** → **Email Routing**, para que `contacto@ssdsproyectos.com` reenvíe a `ssdsproyectos@gmail.com`. Es gratis.
- **Google Search Console:** verifica el dominio con un registro TXT en DNS y envía `https://ssdsproyectos.com/sitemap-index.xml`.
- **Analítica sin cookies:** en el proyecto de Pages → **Metrics** → **Web Analytics**.
- Actualiza el enlace de la bio de Instagram (por ejemplo `https://ssdsproyectos.com/dimensionar/?via=ig`) y el de la firma de correo.
- El subdominio `ssds-proyectos.pages.dev` sigue respondiendo. El `canonical` ya apunta al dominio propio; si lo quieres cerrar del todo, usa una **Bulk Redirect** de `ssds-proyectos.pages.dev` a `https://ssdsproyectos.com`.
