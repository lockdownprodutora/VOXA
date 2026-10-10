export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: Subcategory[];
}

export const OFFICIAL_CATEGORIES: Category[] = [
  {
    id: 'contas-digitais',
    name: 'Contas Digitais',
    slug: 'contas-digitais',
    subcategories: [
      { id: 'tiktok', name: 'TikTok' },
      { id: 'instagram', name: 'Instagram' },
      { id: 'facebook', name: 'Facebook' },
      { id: 'threads', name: 'Threads' },
      { id: 'youtube', name: 'YouTube' },
      { id: 'kwai', name: 'Kwai' }
    ]
  },
  {
    id: 'automoveis',
    name: 'Automóveis',
    slug: 'automoveis',
    subcategories: [
      { id: 'carros', name: 'Carros' },
      { id: 'motos', name: 'Motos' }
    ]
  },
  {
    id: 'produtos-fisicos',
    name: 'Produtos Físicos',
    slug: 'produtos-fisicos',
    subcategories: [
      { id: 'eletronicos', name: 'Eletrônicos' },
      { id: 'copos', name: 'Copos' },
      { id: 'roupas', name: 'Roupas' },
      { id: 'acessorios', name: 'Acessórios' }
    ]
  },
  {
    id: 'servicos',
    name: 'Serviços',
    slug: 'servicos',
    subcategories: [
      { id: 'criacao-de-sites', name: 'Criação de Sites' },
      { id: 'producao-musical', name: 'Produção Musical' },
      { id: 'beats', name: 'Beats' },
      { id: 'packs', name: 'Packs' },
      { id: 'merchandising', name: 'Merchandising' }
    ]
  },
  {
    id: 'digital',
    name: 'Digital',
    slug: 'digital',
    subcategories: [
      { id: 'downloads', name: 'Downloads' },
      { id: 'licencas', name: 'Licenças' }
    ]
  },
  {
    id: 'gift-cards',
    name: 'Gift Cards',
    slug: 'gift-cards',
    subcategories: [
      { id: 'cards-de-desconto', name: 'Cards de Desconto' },
      { id: 'cards-de-assinaturas-digitais', name: 'Cards de Assinaturas Digitais' }
    ]
  }
];

// Map old category values to the new official structure safely
export function mapOldCategory(oldCat: string): { category: string; subcategory: string } {
  const norm = (oldCat || '').trim().toLowerCase();
  
  if (norm.includes('roupa') || norm.includes('vestuário') || norm.includes('copo') || norm.includes('acessório') || norm.includes('físico') || norm.includes('físicos')) {
    let sub = 'Roupas';
    if (norm.includes('copo')) sub = 'Copos';
    if (norm.includes('acessório')) sub = 'Acessórios';
    if (norm.includes('eletrônic')) sub = 'Eletrônicos';
    return { category: 'Produtos Físicos', subcategory: sub };
  }
  
  if (norm.includes('eletrônic')) {
    return { category: 'Produtos Físicos', subcategory: 'Eletrônicos' };
  }
  
  if (norm.includes('conta') || norm.includes('tiktok') || norm.includes('instagram') || norm.includes('youtube')) {
    let sub = 'Instagram';
    if (norm.includes('tiktok')) sub = 'TikTok';
    if (norm.includes('youtube')) sub = 'YouTube';
    return { category: 'Contas Digitais', subcategory: sub };
  }
  
  if (norm.includes('automóvel') || norm.includes('carro') || norm.includes('moto')) {
    let sub = 'Carros';
    if (norm.includes('moto')) sub = 'Motos';
    return { category: 'Automóveis', subcategory: sub };
  }
  
  if (norm.includes('serviço') || norm.includes('design') || norm.includes('produção') || norm.includes('beat') || norm.includes('merch')) {
    let sub = 'Produção Musical';
    if (norm.includes('design') || norm.includes('site')) sub = 'Criação de Sites';
    if (norm.includes('beat')) sub = 'Beats';
    if (norm.includes('merch')) sub = 'Merchandising';
    return { category: 'Serviços', subcategory: sub };
  }
  
  if (norm.includes('gift') || norm.includes('card') || norm.includes('cupom')) {
    return { category: 'Gift Cards', subcategory: 'Cards de Desconto' };
  }
  
  if (norm.includes('digital') || norm.includes('download') || norm.includes('licença') || norm.includes('stem')) {
    let sub = 'Downloads';
    if (norm.includes('licença')) sub = 'Licenças';
    return { category: 'Digital', subcategory: sub };
  }
  
  // Default fallback
  return { category: 'Produtos Físicos', subcategory: 'Roupas' };
}
