import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Cloudflare Pages (.github/workflows/deploy.yml): production builds get SITE_URL from the repo variable (the own
// domain) and no PAGES_BASE. PAGES_BASE=/<repo> is only for a GitHub Pages project site. Without SITE_URL (previews,
// local builds) the build emits no absolute canonical / og:url / sitemap instead of pointing at an unconfirmed domain.
const site = process.env.SITE_URL || undefined;
const base = process.env.PAGES_BASE || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
