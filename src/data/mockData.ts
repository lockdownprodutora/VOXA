import { Artist, Show, Product, ReleaseTrack } from '../types';

export const ARTISTS: Artist[] = [
  {
    id: '1',
    name: 'MC KRONOS',
    genre: 'Trap / Hard Drill',
    image: 'https://images.unsplash.com/photo-1509783236416-c9ad59bae472?q=80&w=800&auto=format&fit=crop',
    listeners: '1.4M',
    topTrack: 'Sangue no Asfalto'
  },
  {
    id: '2',
    name: 'YUNG CYBER',
    genre: 'Cyber Rap / Phonk',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    listeners: '980K',
    topTrack: 'Neon & Concreto'
  },
  {
    id: '3',
    name: 'NINA LOCK',
    genre: 'R&B / Dark Trap',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    listeners: '2.1M',
    topTrack: 'Fuga na Madruga'
  },
  {
    id: '4',
    name: 'KREED',
    genre: 'Underground BoomBap',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop',
    listeners: '650K',
    topTrack: 'Favela Tech'
  }
];

export const SHOWS: Show[] = [
  {
    id: '1',
    city: 'São Paulo, SP',
    venue: 'Audio Club - Lockdown Fest',
    date: '18 AGO 2026',
    price: 'R$ 80,00',
    status: 'Disponível'
  },
  {
    id: '2',
    city: 'Rio de Janeiro, RJ',
    venue: 'Circo Voador',
    date: '25 AGO 2026',
    price: 'R$ 95,00',
    status: 'Últimos Ingressos'
  },
  {
    id: '3',
    city: 'Belo Horizonte, MG',
    venue: 'Mister Rock',
    date: '02 SET 2026',
    price: 'R$ 70,00',
    status: 'Disponível'
  },
  {
    id: '4',
    city: 'Curitiba, PR',
    venue: 'Opera de Arame',
    date: '10 SET 2026',
    price: 'R$ 90,00',
    status: 'Esgotado'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Moletom Oversized Lockdown',
    category: 'Moletom',
    price: 'R$ 349,90',
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800&auto=format&fit=crop',
    badge: 'LANÇAMENTO'
  },
  {
    id: '2',
    name: 'Boné Dad Hat Lockdown Red',
    category: 'Boné',
    price: 'R$ 129,90',
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800&auto=format&fit=crop',
    badge: 'BEST SELLER'
  },
  {
    id: '3',
    name: 'Camiseta Heavyweight Cyber Duck',
    category: 'Moletom',
    price: 'R$ 189,90',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: '4',
    name: 'Balaclava Tactical Lockdown',
    category: 'Acessório',
    price: 'R$ 89,90',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
    badge: 'LIMITADO'
  }
];

export const INITIAL_RELEASES: ReleaseTrack[] = [
  {
    id: 'rel-1',
    title: 'SANGUE NO ASFALTO (REMIX)',
    artist: 'MC KRONOS feat. KREED',
    albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    duration: '2:45',
    genre: 'Trap / Hard Drill',
    status: 'Pendente',
    dateAdded: 'Hoje, 02:15'
  },
  {
    id: 'rel-2',
    title: 'SISTEMA EM COLAPSO',
    artist: 'YUNG CYBER',
    albumCover: 'https://images.unsplash.com/photo-1509783236416-c9ad59bae472?q=80&w=800&auto=format&fit=crop',
    duration: '3:10',
    genre: 'Cyber Rap',
    status: 'Pendente',
    dateAdded: 'Ontem, 23:40'
  },
  {
    id: 'rel-3',
    title: 'NOTCHES NO CONCRETO',
    artist: 'NINA LOCK',
    albumCover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    duration: '2:58',
    genre: 'Dark Trap',
    status: 'Pendente',
    dateAdded: 'Ontem, 20:12'
  },
  {
    id: 'rel-4',
    title: 'SUBMUNDO BOOMBAP',
    artist: 'KREED',
    albumCover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop',
    duration: '3:40',
    genre: 'BoomBap',
    status: 'Pendente',
    dateAdded: 'Há 2 dias'
  },
  {
    id: 'rel-5',
    title: 'LOCKDOWN ANTHEM',
    artist: 'LOCKDOWN ALLSTARS',
    albumCover: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800&auto=format&fit=crop',
    duration: '3:15',
    genre: 'Trap Heavy',
    status: 'Pendente',
    dateAdded: 'Há 3 dias'
  }
];

export const WHATSAPP_GROUPS = [
  { id: '1', name: '👑 Diretoria Lockdown (Oficial)', members: '48 membros', link: 'https://chat.whatsapp.com/lockdown-dir' },
  { id: '2', name: '🎤 Artistas & Beats 2026', members: '124 membros', link: 'https://chat.whatsapp.com/lockdown-artists' },
  { id: '3', name: '🔥 Lançamentos & Distribuição', members: '89 membros', link: 'https://chat.whatsapp.com/lockdown-dist' },
  { id: '4', name: '🎟️ Produção de Shows & Tour', members: '34 membros', link: 'https://chat.whatsapp.com/lockdown-shows' },
];

export const ACAPELLAS_LIST = [
  { id: '1', title: 'Sangue no Asfalto (Acapella 140BPM)', artist: 'MC KRONOS', size: '48 MB', format: 'WAV 24-bit' },
  { id: '2', title: 'Neon & Concreto (Dry Vocals)', artist: 'YUNG CYBER', size: '52 MB', format: 'WAV 24-bit' },
  { id: '3', title: 'Fuga na Madruga (Stem Pack)', artist: 'NINA LOCK', size: '110 MB', format: 'ZIP / WAV' },
  { id: '4', title: 'Favela Tech (Stems + MIDI)', artist: 'KREED', size: '85 MB', format: 'ZIP / WAV' },
];
