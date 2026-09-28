import type { APIRoute } from 'astro';

// Proposal builds (PUBLIC_DEMO=1) stay out of search engines; the real site allows everything.
export const GET: APIRoute = ({ site }) => {
  const demo = !!import.meta.env.PUBLIC_DEMO;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const body = demo
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${site?.origin ?? ''}${base}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
