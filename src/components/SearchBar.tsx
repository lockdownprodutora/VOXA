import React, { useState } from 'react';

export const SearchBar: React.FC<{ onResult: (text: string) => void }> = ({ onResult }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      onResult(data.text || 'Sem resultados.');
    } catch (e) {
      console.error(e);
      onResult('Erro ao buscar notícias.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 w-full p-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 p-2 bg-gray-800 rounded text-white border border-gray-700 focus:outline-none focus:border-red-600"
        placeholder="Pesquisar notícias e tendências..."
      />
      <button 
        onClick={handleSearch} 
        className="px-4 py-2 bg-red-600 rounded text-white font-medium hover:bg-red-700 transition" 
        disabled={loading}
      >
        {loading ? 'Buscando...' : 'Buscar'}
      </button>
    </div>
  );
};
