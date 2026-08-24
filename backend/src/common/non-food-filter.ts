const NON_FOOD_KEYWORDS = [
  'sapato', 'calçado', 'calcado', 'capinha', 'celular', 'variedades', '1 real', 'um real',
  'presentes', 'presente', 'vestuario', 'vestuário', 'confecção', 'confeccao', 'confecções',
  'otica', 'ótica', 'farmacia', 'farmácia', 'drogaria', 'construção', 'construcao', 'moveis',
  'móveis', 'auto peças', 'auto pecas', 'barbearia', 'salão', 'salao', 'pet shop', 'vet',
  'vestido', 'moda', 'utilidades', 'biju', 'bijouteria', 'bijuteria', 'floricultura',
  'papelaria', 'bazar', 'chaveiro', 'estética', 'estetica', 'informática', 'informatica',
  'eletronico', 'eletrônico', 'game', 'brinquedo', 'perfumaria', 'cosmetico', 'cosmético',
  'eletrica', 'elétrica', 'ferragem', 'tinta', 'marcenaria', 'colchão', 'colchao', 'pisos',
  'vidraçaria', 'vidracaria', 'imóveis', 'imoveis', 'corretor', 'mecanica', 'mecânica',
  'lava jato', 'pneus', 'auto center', 'oficina', 'hospital', 'postagem', 'grafica', 'gráfica',
  'fotografia', 'joalheria', 'relojoaria', 'lingerie', 'armarinho', 'enxovais', 'brinquedos',
  'boutique', 'boate', 'casa noturna', 'escritorio', 'escritório', 'advocacia', 'contabilidade',
  'consultoria', 'estofaria', 'funilaria', 'suplemento', 'suplementos'
];

export function isNonFoodBusiness(name: string, cnaeDescription?: string): boolean {
  if (!name) return false;
  const fullName = (name + ' ' + (cnaeDescription || '')).toLowerCase();
  return NON_FOOD_KEYWORDS.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(fullName);
  });
}
