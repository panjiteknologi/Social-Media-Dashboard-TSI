import { htmlToText } from '../cms/checklist';

export interface PageSignals {
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  h1Count: number;
  /** Images with no alt attribute at all; alt="" marks a decorative image and is fine. */
  imagesMissingAlt: number;
  /** Schema.org types in JSON-LD blocks; "invalid" for a block that is not valid JSON. */
  jsonLd: string[];
  /** Every href on the page, as written. */
  links: string[];
}

/** An attribute's value in one tag, or null when the attribute is absent. */
function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

const nonEmpty = (value: string): string | null => (value.trim() === '' ? null : value.trim());

function schemaTypes(json: string): string[] {
  try {
    const data: unknown = JSON.parse(json);
    const nodes = [data].flat().flatMap((node) => {
      const graph = (node as { '@graph'?: unknown } | null)?.['@graph'];
      return graph ? [graph].flat() : [node];
    });
    const types = nodes
      .flatMap((node) => [(node as { '@type'?: unknown } | null)?.['@type']].flat())
      .filter((type): type is string => typeof type === 'string');
    return types.length > 0 ? types : ['unknown'];
  } catch {
    return ['invalid'];
  }
}

/** The SEO-relevant signals in a page's HTML. Regular expressions are enough for these few well-formed tags. */
export function extractPageSignals(html: string, pageUrl: string): PageSignals {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metaContent = (name: string): string | null => {
    const tag = metas.find((meta) => (attribute(meta, 'name') ?? '').toLowerCase() === name);
    return tag ? attribute(tag, 'content') : null;
  };
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((link) =>
    (attribute(link, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'),
  );
  const canonicalHref = canonicalTag ? attribute(canonicalTag, 'href') : null;
  let canonical: string | null = null;
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, pageUrl).href;
    } catch {
      canonical = canonicalHref;
    }
  }

  return {
    title: nonEmpty(htmlToText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')),
    description: nonEmpty(htmlToText(metaContent('description') ?? '')),
    canonical,
    noindex: /\bnoindex\b/i.test(metaContent('robots') ?? ''),
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    imagesMissingAlt: (html.match(/<img\b[^>]*>/gi) ?? []).filter((image) => attribute(image, 'alt') === null).length,
    jsonLd: [
      ...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ].flatMap((match) => schemaTypes(match[1])),
    links: (html.match(/<a\b[^>]*>/gi) ?? [])
      .map((anchor) => attribute(anchor, 'href'))
      .filter((href): href is string => Boolean(href)),
  };
}

/**
 * A link as an absolute https URL on the website, without query string or
 * fragment; null for other hosts and for mailto:, tel: and similar links.
 */
export function internalUrl(href: string, base: string, host: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed.startsWith('#') || /^(mailto|tel|sms|javascript|data|whatsapp):/i.test(trimmed)) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || url.hostname !== host) return null;
  url.protocol = 'https:';
  url.hash = '';
  url.search = '';
  return url.href;
}

/** Page URLs listed in a sitemap. */
export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, '&'));
}
