import { describe, expect, it } from 'vitest';
import { extractPageSignals, internalUrl, parseSitemap } from './html';

const host = 'tsicertification.com';

describe('extractPageSignals', () => {
  const html = `<!doctype html><html lang="en"><head>
    <title>ISO 9001 &amp; ISO 14001 - TSI</title>
    <meta name="description" content="Sertifikasi ISO untuk perusahaan">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="/iso-9001-qms/">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"ProfessionalService"},{"@type":"WebSite"}]}</script>
    <script type="application/ld+json">{broken</script>
  </head><body>
    <h1>ISO 9001</h1>
    <img src="a.png" alt="Logo"><img src="b.png" alt=""><img src="c.png">
    <a href="/contact-us/">Contact</a><a href="https://wa.me/62">WA</a><a href='mailto:x@y.z'>Mail</a>
  </body></html>`;

  it('reads title, description, canonical, headings, images, schema and links', () => {
    expect(extractPageSignals(html, 'https://tsicertification.com/iso-9001-qms/')).toEqual({
      title: 'ISO 9001 & ISO 14001 - TSI',
      description: 'Sertifikasi ISO untuk perusahaan',
      canonical: 'https://tsicertification.com/iso-9001-qms/',
      noindex: false,
      h1Count: 1,
      imagesMissingAlt: 1,
      jsonLd: ['ProfessionalService', 'WebSite', 'invalid'],
      links: ['/contact-us/', 'https://wa.me/62', 'mailto:x@y.z'],
    });
  });

  it('treats missing tags as missing', () => {
    const signals = extractPageSignals('<html><head><title> </title><meta name="robots" content="noindex"></head></html>', 'https://tsicertification.com/x/');
    expect(signals).toMatchObject({ title: null, description: null, canonical: null, noindex: true, jsonLd: [] });
  });
});

describe('internalUrl', () => {
  const base = 'https://tsicertification.com/blog/';

  it('resolves website links without query string or fragment', () => {
    expect(internalUrl('../contact-us/?ref=nav#form', base, host)).toBe('https://tsicertification.com/contact-us/');
    expect(internalUrl('http://tsicertification.com/appeal/', base, host)).toBe('https://tsicertification.com/appeal/');
  });

  it('ignores other hosts and non-page links', () => {
    expect(internalUrl('https://erp.tsicertification.com/', base, host)).toBeNull();
    expect(internalUrl('mailto:info@tsicertification.com', base, host)).toBeNull();
    expect(internalUrl('#top', base, host)).toBeNull();
    expect(internalUrl('tel:+62', base, host)).toBeNull();
  });
});

describe('parseSitemap', () => {
  it('lists every loc', () => {
    const xml = '<urlset><url><loc>https://tsicertification.com/</loc></url><url><loc> https://tsicertification.com/a/?x=1&amp;y=2 </loc></url></urlset>';
    expect(parseSitemap(xml)).toEqual(['https://tsicertification.com/', 'https://tsicertification.com/a/?x=1&y=2']);
  });
});
