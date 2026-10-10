/**
 * SEO & Metadata Utility Module
 * Handles dynamic Title, Meta Tags, Canonical URLs, and Schema.org JSON-LD injection on the client side.
 * Supports SEO-friendly dynamic slugs for products, shows, and artists.
 */

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents & diacritics (e.g. ã, é, ç -> a, e, c)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

export interface SeoMetaData {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'product' | 'music.song' | 'music.playlist' | 'event';
  robots?: 'index, follow' | 'noindex, nofollow' | 'noindex, follow';
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80";

export function getSeoMetadata(
  activeTab: string,
  pathname: string,
  extraData?: {
    products?: any[];
    shows?: any[];
    artists?: any[];
  }
): SeoMetaData {
  const domain = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://voxaofficial.com';
  const cleanPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const pathParts = cleanPath.split('/');
  
  // 1. DYNAMIC SLUG OVERRIDES
  if (pathParts[0] === 'store' && pathParts[1]) {
    const slug = pathParts[1];
    const products = extraData?.products || [];
    const product = products.find(p => slugify(p.name) === slug || p.id === slug);
    
    if (product) {
      const prodUrl = `${domain}/store/${slugify(product.name)}`;
      return {
        title: `${product.name} | Lockdown Market`,
        description: (product.description || product.shortDesc || `Adquira ${product.name} na Lockdown Store oficial.`).slice(0, 155),
        canonical: prodUrl,
        ogTitle: product.name,
        ogDescription: product.description || product.shortDesc,
        ogImage: product.image || DEFAULT_IMAGE,
        ogType: 'product',
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "image": product.image,
          "description": product.description || product.shortDesc,
          "offers": {
            "@type": "Offer",
            "price": product.price,
            "priceCurrency": "BRL",
            "availability": "https://schema.org/InStock",
            "url": prodUrl
          }
        }
      };
    }
  }

  if (pathParts[0] === 'tickets' && pathParts[1]) {
    const slug = pathParts[1];
    const shows = extraData?.shows || [];
    const show = shows.find(s => slugify(s.city) === slug || s.id === slug);
    
    if (show) {
      const showUrl = `${domain}/tickets/${slugify(show.city)}`;
      return {
        title: `Ingressos ${show.city} em ${show.venue} | Lockdown Produtora`,
        description: `Adquira seu ingresso para o show em ${show.city} no dia ${show.date}. Local: ${show.venue}. Venda segura oficial.`.slice(0, 155),
        canonical: showUrl,
        ogTitle: `Shows em ${show.city} - Ingressos Oficiais`,
        ogDescription: `Garanta já seu convite para o show em ${show.city} no dia ${show.date} no ${show.venue}.`,
        ogImage: show.imageUrl || DEFAULT_IMAGE,
        ogType: 'event',
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": `Lockdown Live: ${show.city}`,
          "startDate": show.date,
          "location": {
            "@type": "Place",
            "name": show.venue,
            "address": show.address || show.formattedAddress || show.city
          },
          "image": show.imageUrl,
          "description": show.description || `Show exclusivo e performances ao vivo organizadas pela Lockdown Produtora.`,
          "offers": {
            "@type": "Offer",
            "url": showUrl,
            "price": show.price ? (parseFloat(show.price.replace(/[^\d,]/g, '').replace(',', '.')) || 50) : 50,
            "priceCurrency": "BRL",
            "availability": "https://schema.org/InStock"
          }
        }
      };
    }
  }

  if (pathParts[0] === 'artistas' && pathParts[1]) {
    const slug = pathParts[1];
    const artists = extraData?.artists || [];
    const artist = artists.find(a => slugify(a.name) === slug || a.id === slug);
    
    if (artist) {
      const artistUrl = `${domain}/artistas/${slugify(artist.name)}`;
      return {
        title: `${artist.name} | Lockdown Produtora`,
        description: `Conheça ${artist.name}, artista agenciado exclusivo da Lockdown Produtora. Veja lançamentos, streams e agenda.`.slice(0, 155),
        canonical: artistUrl,
        ogTitle: `${artist.name} - Portfólio Oficial`,
        ogDescription: artist.bio || `Confira as músicas e a trajetória de ${artist.name} na Lockdown Produtora.`,
        ogImage: artist.photoUrl || artist.avatar || DEFAULT_IMAGE,
        ogType: 'website',
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "mainEntity": {
            "@type": "Person",
            "name": artist.name,
            "jobTitle": artist.role || "Artista / DJ",
            "image": artist.photoUrl || artist.avatar,
            "description": artist.bio || "Membro do selo musical da Lockdown Produtora"
          }
        }
      };
    }
  }

  // 2. STATIC TAB CORRESPONDENCES
  switch (activeTab) {
    case 'home':
      return {
        title: "VOXA — Uma nova dimensão social.",
        description: "Uma nova dimensão social. Uma rede social futurista e ecossistema digital completo.",
        canonical: domain,
        ogTitle: "VOXA — Uma nova dimensão social.",
        ogDescription: "Uma nova dimensão social. Uma rede social futurista e ecossistema digital completo.",
        ogImage: DEFAULT_IMAGE,
        ogType: 'website',
        robots: 'index, follow',
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "VOXA",
            "url": domain,
            "logo": `${domain}/favicon.ico`
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "VOXA",
            "url": domain
          }
        ]
      };

    case 'music':
      return {
        title: "Artistas & Lançamentos Musicais | Lockdown Produtora",
        description: "Confira a playlist e os streams oficiais de funk, trap, phonk de nossos DJs e MCs exclusivos. Ouça agora online e faça envios.",
        canonical: `${domain}/music`,
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
            { "@type": "ListItem", "position": 2, "name": "Músicas", "item": `${domain}/music` }
          ]
        }
      };

    case 'tickets':
      return {
        title: "Agenda de Shows & Ingressos Oficiais | Lockdown Produtora",
        description: "Garanta seus ingressos oficiais para os melhores shows e festivais urbanos organizados pela Lockdown Produtora. Compra segura online.",
        canonical: `${domain}/tickets`,
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
            { "@type": "ListItem", "position": 2, "name": "Shows", "item": `${domain}/tickets` }
          ]
        }
      };

    case 'store':
      return {
        title: "Lockdown Market | Loja Oficial de Roupas e Beats",
        description: "Adquira moletons, camisetas, bonés oficiais ou contas e produtos digitais exclusivos na Lockdown Store. Atendimento e suporte garantidos.",
        canonical: `${domain}/store`,
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
            { "@type": "ListItem", "position": 2, "name": "Store", "item": `${domain}/store` }
          ]
        }
      };

    case 'subscriptions':
      return {
        title: "Planos de Assinatura & Membresias VIP | Lockdown Produtora",
        description: "Seja um membro oficial VIP Lockdown. Tenha acesso a canais exclusivos, distribuição diferenciada, sorteios e benefícios adicionais.",
        canonical: `${domain}/assinaturas`,
        robots: 'index, follow',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
            { "@type": "ListItem", "position": 2, "name": "Assinaturas", "item": `${domain}/assinaturas` }
          ]
        }
      };

    case 'dashboard':
      return {
        title: "Painel do Usuário | Lockdown Produtora",
        description: "Acesse sua área logada para gerenciar compras, acompanhar ingressos de shows, verificar assinaturas e enviar novas faixas.",
        canonical: `${domain}/dashboard`,
        robots: 'noindex, nofollow'
      };

    case 'admin':
      return {
        title: "Painel Administrativo | Lockdown Produtora",
        description: "Área reservada para administração e moderação da Lockdown Produtora.",
        canonical: `${domain}/admin`,
        robots: 'noindex, nofollow'
      };

    case '404':
      return {
        title: "Página Não Encontrada | 404 Lockdown Produtora",
        description: "Desculpe, a página que você está procurando não existe ou foi removida temporariamente.",
        canonical: `${domain}/404`,
        robots: 'noindex, follow'
      };

    default:
      return {
        title: "Lockdown Produtora | A Rua É Nossa",
        description: "Agenciamento artístico profissional, lançamentos de funk, trap, phonk e eventos corporativos e urbanos. Lockdown Produtora.",
        canonical: domain,
        robots: 'index, follow'
      };
  }
}

/**
 * Dynamically injects SEO Meta tags, canonical links, and Schema.org JSON-LD scripts in the HTML document.
 */
export function updateDocumentSeo(meta: SeoMetaData): void {
  if (typeof document === 'undefined') return;

  // 1. Update document title
  document.title = meta.title;

  // 2. Update meta description
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.setAttribute('name', 'description');
    document.head.appendChild(descMeta);
  }
  descMeta.setAttribute('content', meta.description);

  // 3. Update canonical link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', meta.canonical);

  // 4. Update robots meta tag
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', meta.robots || 'index, follow');

  // 5. Update Open Graph dynamic tags
  const ogTags = {
    'og:title': meta.ogTitle || meta.title,
    'og:description': meta.ogDescription || meta.description,
    'og:image': meta.ogImage || DEFAULT_IMAGE,
    'og:url': meta.canonical,
    'og:type': meta.ogType || 'website',
    'og:site_name': 'Lockdown Produtora'
  };

  for (const [property, content] of Object.entries(ogTags)) {
    let ogMeta = document.querySelector(`meta[property="${property}"]`);
    if (!ogMeta) {
      ogMeta = document.createElement('meta');
      ogMeta.setAttribute('property', property);
      document.head.appendChild(ogMeta);
    }
    ogMeta.setAttribute('content', content);
  }

  // 6. Inject Schema.org JSON-LD
  // Remove existing injected schema script tags
  const existingSchemas = document.querySelectorAll('script[id^="jsonld-seo-"]');
  existingSchemas.forEach(el => el.remove());

  if (meta.jsonLd) {
    const schemas = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    schemas.forEach((schema, index) => {
      const script = document.createElement('script');
      script.id = `jsonld-seo-${index}`;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });
  }
}
