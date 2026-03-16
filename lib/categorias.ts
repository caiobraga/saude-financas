/**
 * Subcategorias e mapeamento categoria → subcategoria.
 * Usado na planilha e na exportação xlsx para agrupar despesas.
 */
export const SUBCATEGORIAS = [
  "Casa",
  "Saúde",
  "Empresa",
  "Consórcio",
  "Assinaturas mensais",
  "Variáveis",
  "Igreja",
] as const;

export type Subcategoria = (typeof SUBCATEGORIAS)[number];

/**
 * Mapeamento: categoria (como cadastrada nas transações) → subcategoria.
 * Categorias não listadas ficam como "Outras".
 */
const CATEGORIA_PARA_SUBCATEGORIA: Record<string, Subcategoria> = {
  // Casa
  "Água": "Casa",
  "Energia / Luz": "Casa",
  "Gás": "Casa",
  "Contas e utilidades": "Casa",
  "Supermercado": "Casa",
  "Telefonia / Internet": "Casa",
  "Alimentação": "Casa",
  "Alimentação - delivery": "Casa",
  "Condomínio": "Casa",
  "Aluguel": "Casa",
  "Faxina": "Casa",
  "Mercado": "Casa",
  "Luz": "Casa",
  "Energia": "Casa",
  "Internet": "Casa",
  "Telefone": "Casa",

  // Saúde
  "Saúde": "Saúde",
  "Farmácia": "Saúde",
  "Academia": "Saúde",
  "Plano de saúde": "Saúde",
  "Médico": "Saúde",
  "Consulta": "Saúde",
  "Exame": "Saúde",
  "Dentista": "Saúde",
  "Laboratório": "Saúde",

  // Empresa
  "Pró-labore": "Empresa",
  "Tarifas bancárias": "Empresa",
  "Fornecedores": "Empresa",
  "Impostos": "Empresa",
  "IPTU": "Empresa",
  "IPVA": "Empresa",

  // Consórcio
  "Consórcio": "Consórcio",
  "Consorcio": "Consórcio",
  "Prestação consórcio": "Consórcio",
  "Parcela consórcio": "Consórcio",

  // Assinaturas mensais
  "Entretenimento": "Assinaturas mensais",
  "Netflix": "Assinaturas mensais",
  "Spotify": "Assinaturas mensais",
  "Streaming": "Assinaturas mensais",
  "Assinatura": "Assinaturas mensais",
  "Assinaturas": "Assinaturas mensais",

  // Variáveis (gastos que variam mês a mês)
  "Combustível": "Variáveis",
  "Transporte": "Variáveis",
  "Transporte - pedágio": "Variáveis",
  "Pedágio": "Variáveis",
  "Educação": "Variáveis",
  "Escola": "Variáveis",
  "Curso": "Variáveis",
  "Lazer": "Variáveis",
  "Restaurante": "Variáveis",
  "Viagem": "Variáveis",
  "Outras despesas": "Variáveis",

  // Igreja
  "Igreja": "Igreja",
  "Dízimo": "Igreja",
  "Doação": "Igreja",
  "Doações": "Igreja",
  "Oferta": "Igreja",
  "Caridade": "Igreja",
};

const OUTRAS: Subcategoria = "Variáveis";

/**
 * Retorna a subcategoria da categoria informada (ou "Variáveis" como fallback).
 */
export function getSubcategoria(category: string | null): string {
  if (!category || !category.trim()) return OUTRAS;
  const cat = category.trim();
  return CATEGORIA_PARA_SUBCATEGORIA[cat] ?? OUTRAS;
}

/**
 * Ordena subcategorias na ordem definida em SUBCATEGORIAS; as que não estão na lista vão no fim.
 */
export function ordenarSubcategorias(subcategorias: string[]): string[] {
  const ordem = new Map(SUBCATEGORIAS.map((s, i) => [s, i]));
  return [...subcategorias].sort((a, b) => {
    const ia = ordem.get(a as Subcategoria) ?? 999;
    const ib = ordem.get(b as Subcategoria) ?? 999;
    return ia - ib;
  });
}
