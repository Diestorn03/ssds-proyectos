import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site: SITE_URL=https://<user>.github.io  PAGES_BASE=/<repo>
// Final domain: leave both unset (base "/", site = the future domain).
const site = process.env.SITE_URL || 'https://ssdsproyectos.com';
const base = process.env.PAGES_BASE || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
