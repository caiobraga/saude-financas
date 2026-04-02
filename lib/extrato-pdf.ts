/**
 * Extrai transações do texto de um extrato bancário (PDF já convertido em texto).
 * Suporta formatos comuns no Brasil, incluindo Banco do Brasil (BB):
 * - Data dd/mm/yyyy (na mesma linha ou na linha anterior)
 * - Valor no formato 1.234,56 ou 1.234,56 (+) / 1.234,56 (-)
 * - Descrição na mesma linha ou em linhas seguintes
 */

export interface TransacaoExtrato {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // positivo = crédito, negativo = débito
  type: "credit" | "debit";
  category?: string | null; // inferida pela descrição, em branco se não identificar
  /** Número da parcela (ex.: 2 em 2/12). Preenchido quando a descrição indica parcelamento. */
  parcela_numero?: number | null;
  /** Total de parcelas (ex.: 12 em 2/12). Preenchido quando detectado. */
  parcela_total?: number | null;
}

/**
 * Tenta extrair número e total de parcelas da descrição (ex.: "PARC 2/12", "2 DE 12", "3ª parcela de 12").
 * Retorna { numero, total } ou null se não identificar.
 */
export function extrairParcelaDaDescricao(description: string): { numero: number; total: number } | null {
  const d = description.trim();
  if (d.length < 3) return null;

  const normalized = d.toUpperCase().replace(/\s+/g, " ");

  // PARC 1/12, PARCELA 2/12, PAGTO PARC 3-12, PARC 3-12
  const parcSlash = normalized.match(/\bPARC(?:ELA)?\s*(\d{1,3})\s*[\/\-]\s*(\d{1,3})\b/);
  if (parcSlash) {
    const numero = parseInt(parcSlash[1], 10);
    const total = parseInt(parcSlash[2], 10);
    if (numero >= 1 && total >= 1 && numero <= total) return { numero, total };
  }

  // 1/12 ou 2/12 quando há "parc" ou "parcela" na descrição (evita confundir com data)
  if (/\bPARC(?:ELA)?\b/.test(normalized)) {
    const slash = normalized.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
    if (slash) {
      const numero = parseInt(slash[1], 10);
      const total = parseInt(slash[2], 10);
      if (numero >= 1 && total >= 1 && numero <= total) return { numero, total };
    }
  }

  // 2 DE 12, PARCELA 1 DE 12
  const deMatch = normalized.match(/\b(?:PARC(?:ELA)?\s*)?(\d{1,3})\s+DE\s+(\d{1,3})\b/);
  if (deMatch) {
    const numero = parseInt(deMatch[1], 10);
    const total = parseInt(deMatch[2], 10);
    if (numero >= 1 && total >= 1 && numero <= total) return { numero, total };
  }

  // 3ª PARCELA DE 12, 3 PARCELA DE 12
  const ordMatch = normalized.match(/\b(\d{1,3})[ª]?\s*PARCELA\s*(?:DE\s*)?(\d{1,3})?\b/);
  if (ordMatch) {
    const numero = parseInt(ordMatch[1], 10);
    const total = ordMatch[2] ? parseInt(ordMatch[2], 10) : null;
    if (numero >= 1 && (total == null || (total >= 1 && numero <= total)))
      return { numero, total: total ?? numero };
  }

  return null;
}

/**
 * Padrões para inferir categoria a partir da descrição (ordem importa: primeiro match vence).
 */
const CATEGORIA_POR_DESCRICAO: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(água|agua|sabesp|sanepar|copasa|caesa|cesan)\b/i, category: "Água" },
  { pattern: /\b(luz|energia|eletricidade|cemig|cpfl|enel|energis|neoenergia|equatorial)\b/i, category: "Energia / Luz" },
  { pattern: /\b(gás|gas\s|comgás|ultragaz|brasilgás)\b/i, category: "Gás" },
  { pattern: /\b(conta\s+de\s+água|conta\s+de\s+luz|conta\s+de\s+energia)\b/i, category: "Contas e utilidades" },
  { pattern: /\b(netflix|spotify|disney|disney\+|hbo|hbo\s*max|prime\s*video|globoplay|star\+|paramount|deezer|apple\s*tv|youtube\s*premium)\b/i, category: "Entretenimento" },
  { pattern: /\b(ifood|i\s*food|uber\s*eats|rappi|aiqfome)\b/i, category: "Alimentação - delivery" },
  { pattern: /\b(restaurante|lanchonete|padaria|pizzaria|açaí|acai)\b/i, category: "Alimentação" },
  { pattern: /\b(supermercado|atacadão|atacadao|carrefour|extra|pao\s*de\s*açúcar|pao\s*de\s*acucar|wallmart|walmart|big|angeloni|super\s*mercado)\b/i, category: "Supermercado" },
  { pattern: /\b(farmácia|farmacia|drogaria|drogasil|droga\s*raia|pague\s*menos|ultrafarma)\b/i, category: "Farmácia" },
  { pattern: /\b(médico|medico|hospital|clínica|clinica|unimed|amil|bradesco\s*saúde|bradesco\s*saude|sulamerica|odontolog|dentista|laboratório|laboratorio|exame|consulta)\b/i, category: "Saúde" },
  { pattern: /\b(posto|gasolina|combustível|combustivel|shell|ipiranga|ale|vibra|raizen|posto\s*br)\b/i, category: "Combustível" },
  { pattern: /\b(uber|99|taxi|táxi|lyft|cabify)\b/i, category: "Transporte" },
  { pattern: /\b(pedágio|pedagio|sem\s*parar|conectcar)\b/i, category: "Transporte - pedágio" },
  { pattern: /\b(telefone|vivo|claro|oi\s*telecom|tim|algar|net\s*virtua|oi\s*fibra|claro\s*fibra|plena\s*telecom|operadora)\b/i, category: "Telefonia / Internet" },
  { pattern: /\b(iptu|ipva|imposto|receita\s*federal|prefeitura|pm\s*colatina|secretaria\s*da\s*fazenda)\b/i, category: "Impostos" },
  { pattern: /\b(escola|faculdade|universidade|curso|mensalidade\s*escolar|ensino)\b/i, category: "Educação" },
  { pattern: /\b(academia|gym|smart\s*fit|bio\s*ritmo)\b/i, category: "Academia" },
  { pattern: /\b(plano\s*de\s*saúde|plano\s*saude|convênio|convenio)\b/i, category: "Saúde" },
  { pattern: /\b(encargos|tarifa|tarifa\s*pix|tarifa\s*pacote|taxa\s*bancária|taxa\s*bancaria)\b/i, category: "Tarifas bancárias" },
  { pattern: /\b(pró[- ]?labore|prolabore|retirada\s*sócio|retirada\s*socio)\b/i, category: "Pró-labore" },
];

function inferirCategoria(description: string): string | null {
  const d = description.trim();
  if (d.length < 2) return null;
  const normalized = d.normalize("NFD").replace(/\p{Diacritic}/gu, ""); // remove acentos para match
  for (const { pattern, category } of CATEGORIA_POR_DESCRICAO) {
    if (pattern.test(d) || pattern.test(normalized)) return category;
  }
  return null;
}

/** Cabeçalhos e rótulos de seção que não são lançamentos. Inclui padrões de vários bancos. */
const SKIP_DESCRIPTION_PATTERNS = [
  /^lançamentos\s*$/i,
  /^dia\s+lot/i,
  /^dia\s+histórico/i,
  /^informações\s+adicionais/i,
  /^informações\s+complementares/i,
  /^lançamentos\s+futuros\s*$/i,
  /\blan[çc]amentos\s+futuros\b/i,
  /\blimites\s+de\s+credito\s+dispon[ií]veis\b/i,
  /\bextratos\s+emitidos\s+at[eé]\b/i,
  /^total\s+aplicações/i,
  /^\s*saldo\s*$/i,
  /^\s*saldo\s+do\s+dia\s*$/i,
  /^\s*saldo\s+anterior\b/i,
  /^\s*saldo\s+bloq\.?\s*anterior\b/i,
  /^\s*histórico\s+de\s+movimenta[çc][aã]o\s*$/i,
  /^data\s+histórico\s+valor\s*$/i,
  /^\s*extrato\s+de\s+conta/i,
  /^cliente\s+/i,
  /^período\s*:/i,
  /^agência\s*:/i,
  /^conta\s*:/i,
  /^associado\s*:/i,
  /^cooperativa\s*:/i,
  /^data\s+descrição/i,
  /^descrição\s+documento/i,
  /valor\s*\(\s*r\s*\$?\s*\)/i,
  /saldo\s*\(\s*r\s*\$?\s*\)/i,
  /^extrato\s*\(/i,
  /sicredi\s+fone|sac\s+\d|ouvidoria\s+\d/i,
  // Bloco RESUMO / saldo do dia com saldo em conta (não é lançamento)
  /saldo\s+do\s+dia\s+[\d.,]+\s*[CD]\s+resumo/i,
  /resumo\s*\(\s*[+\-]?\s*\)\s*saldo\s+em\s+conta/i,
  /saldo\s+em\s+conta\s*:/i,
  /cheque\s+especial\s+contratado/i,
  /juros\s+vencidos\s+provisionados/i,
  /tarifas\s+vencidas\s+provisionadas/i,
  /saldo\s+dispo/i,
  // Fragmentos de linha (parte de descrição quebrada)
  /^juros\s+cta\s+garantida$/i,
];

function shouldSkipDescription(desc: string): boolean {
  const t = desc.trim();
  if (t.length < 2) return true;
  if (t.replace(/\s+/g, "").toUpperCase() === "SALDO") return true;
  if (/^saldo\s+do\s+dia$/i.test(t.replace(/\s+/g, " "))) return true;
  // Descrição que é bloco de cabeçalho (segmento mal cortado no SICOOB: data do período + header)
  if (/^histórico\s+de\s+movimenta[çc][aã]o\s+data\s+histórico\s+valor/i.test(t)) return true;
  // Bloco "SALDO DO DIA X RESUMO (+) SALDO EM CONTA..." inteiro
  if (/saldo\s+do\s+dia\s+[\d.,]+[CD]\s+resumo/i.test(t)) return true;
  if (/\([+\-]\)\s*saldo\s+em\s+conta/i.test(t)) return true;
  return SKIP_DESCRIPTION_PATTERNS.some((p) => p.test(t));
}

/**
 * Ignora linhas/blocos de saldo que às vezes são interpretados como movimentação.
 * Ex.: "SALDO DO DIA", "SALDO ANTERIOR", "SALDO FINAL", "SALDO EM CONTA".
 */
function shouldSkipBalanceContext(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const normalized = t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

  return (
    /\bsaldo\s+do\s+dia\b/.test(normalized) ||
    /\bsaldo\s+anterior\b/.test(normalized) ||
    /\bsaldo\s+bloq\.?\s*anterior\b/.test(normalized) ||
    /\bsaldo\s+final\b/.test(normalized) ||
    /\bsaldo\s+em\s+conta\b/.test(normalized) ||
    /\bsaldo\s+total\s+disponivel(\s+dia)?\b/.test(normalized) ||
    /\bsaldo\s+disponivel\b/.test(normalized) ||
    /\bsaldo\s+bloqueado\b/.test(normalized)
  );
}

/**
 * Alguns PDFs colam "Saldo do dia/final" no fim da mesma linha de uma transação.
 * Nesse caso, preservamos o início (lançamento) e cortamos apenas o trecho de saldo.
 */
function stripTrailingBalanceSegment(text: string): string {
  const marker =
    /\bsaldo\s+do\s+dia\b|\bsaldo\s+anterior\b|\bsaldo\s+bloq\.?\s*anterior\b|\bsaldo\s+final\b|\bsaldo\s+em\s+conta\b|\bsaldo\s+total\s+dispon[ií]vel(?:\s+dia)?\b|\bsaldo\s+dispon[ií]vel\b|\bsaldo\s+bloqueado\b/i;
  const match = marker.exec(text);
  if (!match || match.index <= 0) return text;
  return text.slice(0, match.index).trim();
}

/**
 * Converte valor no formato brasileiro (1.234,56 ou -1.234,56) para número.
 */
function parseValorBrasileiro(str: string): number | null {
  const cleaned = str.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

/**
 * Detecta data no formato dd/mm/yyyy ou dd-mm-yyyy (com ou sem espaços ao redor das barras).
 */
function extrairData(str: string): string | null {
  const match = str.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year =
    y.length === 2 ? (parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`) : y;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extrai ano de referência do texto (ex.: PERÍODO: 01/02/2026 - 28/02/2026 ou primeira data dd/mm/yyyy).
 */
function getReferenceYearFromText(texto: string): number {
  const periodo = texto.match(/per[ií]odo\s*:\s*\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*(\d{4})/i);
  if (periodo) return parseInt(periodo[1], 10);
  const fullDate = texto.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})\b/);
  if (fullDate) return parseInt(fullDate[3], 10);
  return new Date().getFullYear();
}

/**
 * Data apenas dd/mm no início da linha (ex.: SICOOB "02/02 CRÉD.TRANSF... 10,00C").
 * Usa ano de referência do extrato.
 */
function extrairDataDdMmSo(line: string, referenceYear: number): string | null {
  const match = line.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s|$)/);
  if (!match) return null;
  const [, d, m] = match;
  return `${referenceYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Encontra valor no formato brasileiro com sufixo (+)/(-) como no BB.
 * Retorna { value, index, sign: '+' | '-' } ou null.
 */
function extrairValorComSinal(
  line: string
): { value: number; index: number; sign: "+" | "-" } | null {
  let last: { value: number; index: number; sign: "+" | "-" } | null = null;
  const tryRegex = (r: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = r.exec(line)) !== null) {
      const n = parseValorBrasileiro(m[1]);
      if (n !== null)
        last = {
          value: n,
          index: m.index,
          sign: m[2] === "+" ? "+" : "-",
        };
    }
  };
  tryRegex(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(\s*([+-])\s*\)/g);
  if (!last)
    tryRegex(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*[\(\[]?\s*([+-])\s*[\)\]]?/g);
  return last;
}

/**
 * Valor com sufixo C (crédito) ou D (débito), ex.: SICOOB "10,00C" ou "9.150,01D".
 */
function extrairValorComSufixoCD(
  line: string
): { value: number; index: number; sign: "+" | "-" } | null {
  const regex = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])(?:\s|$|\*)/gi;
  let last: { value: number; index: number; sign: "+" | "-" } | null = null;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    const n = parseValorBrasileiro(m[1]);
    if (n !== null)
      last = {
        value: n,
        index: m.index,
        sign: m[2].toUpperCase() === "C" ? "+" : "-",
      };
  }
  return last;
}

/**
 * Encontra o último valor monetário em formato brasileiro (1.234,56 ou -1.234,56).
 * Aceita sufixo C/D (crédito/débito) como em extratos SICOOB.
 */
function extrairValorDaLine(line: string): {
  value: number;
  index: number;
  sign?: "+" | "-";
} | null {
  const comSinal = extrairValorComSinal(line);
  if (comSinal) return comSinal;

  const comCD = extrairValorComSufixoCD(line);
  if (comCD) return comCD;

  const regex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;
  let last: { value: number; index: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    const n = parseValorBrasileiro(m[1]);
    if (n !== null) last = { value: n, index: m.index };
  }
  return last;
}

function inferirTipo(line: string, valor: number, sign?: "+" | "-"): "credit" | "debit" {
  if (sign === "+") return "credit";
  if (sign === "-") return "debit";
  const upper = line.toUpperCase();
  if (/\b(D|DÉB|DEBITO|SAIDA|PAGTO|PAGAMENTO)\b/.test(upper)) return "debit";
  if (/\b(C|CRÉD|CREDITO|ENTRADA|DEPOSITO)\b/.test(upper)) return "credit";
  return valor >= 0 ? "credit" : "debit";
}

/**
 * Limpa e trunca texto para usar como descrição.
 */
function limparDescricao(s: string, maxLen = 200): string {
  const t = s
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return t || "Movimentação";
}

/**
 * Junta linhas de continuação: linhas que não começam com data (dd/mm ou dd/mm/yyyy)
 * são anexadas à linha anterior, pois no PDF a transação pode quebrar em várias linhas.
 */
function juntarLinhasContinuacao(linhas: string[]): string[] {
  // Linha inicia com data (dd/mm ou dd/mm/yyyy) → nova transação; senão → continuação da anterior
  const dataNoInicio = /^\d{1,2}\s*[\/\-]\s*\d{1,2}(?:\s|$|[\/\-]\s*\d)/;
  /** Não colar na transação anterior: é outra seção (evita SICOOB colar "LANÇAMENTOS FUTUROS" no PIX). */
  const cabecalhoNovaSecao =
    /^\s*(lan[çc]amentos\s+futuros|informa[çc][oõ]es\s+adicionais|informa[çc][oõ]es\s+complementares)\b/i;
  const resultado: string[] = [];
  for (const line of linhas) {
    const t = line.trim();
    if (!t) continue;
    if (
      resultado.length > 0 &&
      !dataNoInicio.test(t) &&
      !cabecalhoNovaSecao.test(t)
    ) {
      resultado[resultado.length - 1] += " " + t;
    } else {
      resultado.push(t);
    }
  }
  return resultado;
}

/**
 * Quando o PDF vem em uma única linha com várias transações (ex.: SICOOB),
 * divide em "linhas virtuais" por transação (cada uma começa com dd/mm sem ano).
 * Só divide em dd/mm quando após a data não vem ano (evita quebrar "01/02/2026" do cabeçalho).
 */
function expandirLinhasComMultiplasTransacoes(linhas: string[]): string[] {
  const resultado: string[] = [];
  // dd/mm (sem dígito antes) seguido de espaço e que NÃO seja início de ano → só "30/01 " ou "02/02 "
  const padraoDataInicio = /(?<!\d)(?=\d{1,2}\s*[\/\-]\s*\d{1,2}\s+(?![0-9]{2}))/g;
  const temValorCD = /\d{1,3}(?:\.\d{3})*,\d{2}\s*[CD]/i;

  for (const line of linhas) {
    const multiplosCD = line.match(/\d{1,3}(?:\.\d{3})*,\d{2}\s*[CD]/gi);
    const deveDividir = (multiplosCD?.length ?? 0) > 1 && line.length > 80;

    if (!deveDividir) {
      resultado.push(line);
      continue;
    }

    const partes = line.split(padraoDataInicio).map((p) => p.trim()).filter(Boolean);
    for (const p of partes) {
      if (!/^\d{1,2}\s*[\/\-]\s*\d{1,2}\s+/.test(p)) continue;
      // Ignora datas completas do cabeçalho (ex.: 01/02/2026 ou 28/02/2026 em "PERÍODO:")
      if (/^\d{1,2}\s*[\/\-]\s*\d{1,2}\s*\d{4}\b/.test(p)) continue;
      if (!temValorCD.test(p)) continue;
      resultado.push(p);
    }
  }

  return resultado.length > 0 ? resultado : linhas;
}

/**
 * Parse do texto extraído do PDF. Suporta:
 * - BB: data na linha, valor com "(+)" ou "(-)", descrição na mesma linha ou na seguinte
 * - Outros: data e valor na mesma linha, formato 1.234,56
 * - SICOOB: uma linha com muitas transações (dd/mm ... valor C/D) — expandida antes do parse
 */
export function parseExtratoTexto(texto: string): TransacaoExtrato[] {
  let linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  linhas = juntarLinhasContinuacao(linhas);
  linhas = expandirLinhasComMultiplasTransacoes(linhas);

  const referenceYear = getReferenceYearFromText(texto);
  const transacoes: TransacaoExtrato[] = [];
  let lastDate: string | null = null;
  let pendingDescription: string[] = []; // linhas sem valor que podem ser descrição da próxima transação

  for (let i = 0; i < linhas.length; i++) {
    const lineOriginal = linhas[i];
    const line = stripTrailingBalanceSegment(lineOriginal);
    if (!line) continue;
    const valorInfo = extrairValorDaLine(line);
    if (!valorInfo) {
      // Data no início: dd/mm/yyyy ou dd/mm (SICOOB)
      const dataStr = /^\s*\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{2,4}\b/.test(line)
        ? extrairData(line)
        : /^\s*\d{1,2}\s*[\/\-]\s*\d{1,2}(?:\s|$)/.test(line)
          ? extrairDataDdMmSo(line, referenceYear)
          : null;
      if (dataStr) lastDate = dataStr;
      if (line.length > 2 && !/^\d[\d\s\/\-\.]*$/.test(line))
        pendingDescription.push(line);
      continue;
    }

    const dataStr = extrairData(line) ?? extrairDataDdMmSo(line, referenceYear);
    const date = dataStr ?? lastDate ?? "";
    if (dataStr) lastDate = dataStr;

    const antesValor = line.substring(0, valorInfo.index).trim();
    let descPart = antesValor
      .replace(/^\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{2,4}\s*/, "")
      .replace(/^\d{1,2}\s*[\/\-]\s*\d{1,2}\s+/, "") // dd/mm só (SICOOB)
      .replace(/\s{2,}/g, " ")
      .trim();

    // No blob SICOOB a "continuação" da transação vem depois do valor (ex.: "10,00C 3047 - 637762258 EDIMARA ALVES DE ALMEIDA DOC.: 1707768718"); só aplica quando o valor tem sufixo C/D
    if (/\d{1,3}(?:\.\d{3})*,\d{2}\s*[CD]\b/i.test(line)) {
      const restFromValor = line.slice(valorInfo.index);
      const valueMatch = restFromValor.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])(?:\s|$|\*)/i);
      const valueLen = valueMatch ? valueMatch[0].length : 0;
      const depoisValor = line.substring(valorInfo.index + valueLen).trim();
      const continuacaoAteProximaData = depoisValor.replace(
        /\s*\d{1,2}\s*[\/\-]\s*\d{1,2}\s+(?![0-9]{2}).*$/,
        ""
      ).trim();
      if (continuacaoAteProximaData.length > 0 && (descPart.length < 50 || /^[A-Z][A-Z\s\.\-]+$/.test(descPart))) {
        descPart = (descPart + " " + continuacaoAteProximaData).replace(/\s{2,}/g, " ").trim().slice(0, 200);
      }
    }

    const descIsOnlyNumbers = /^[\d\s\/\-\.]+$/.test(descPart);
    if ((descPart.length < 3 || descIsOnlyNumbers) && pendingDescription.length > 0) {
      descPart = pendingDescription
        .slice(-3)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pendingDescription = [];
    } else if (descPart.length >= 3 && !descIsOnlyNumbers) {
      pendingDescription = [];
    }
    if (descPart.length < 2 || /^[\d\s\/\-\.]+$/.test(descPart))
      descPart = pendingDescription.pop() ?? "";
    else pendingDescription = [];

    // BB: descrição pode vir na linha seguinte (ex: "28/02 09:47 Marciel Plaster")
    if ((descPart.length < 3 || /^[\d\s\/\-\.]+$/.test(descPart)) && i + 1 < linhas.length) {
      const nextLine = linhas[i + 1].trim();
      if (nextLine && !extrairValorDaLine(nextLine) && nextLine.length > 2)
        descPart = nextLine;
    }
    if (descPart.length < 2) descPart = "Movimentação";

    const description = limparDescricao(descPart);
    if (shouldSkipDescription(description)) continue;
    if (shouldSkipBalanceContext(description)) continue;
    if (!date || date.length !== 10) continue;

    const sign = valorInfo.sign;
    const type = inferirTipo(line, valorInfo.value, sign);
    const amount =
      type === "debit"
        ? -Math.abs(valorInfo.value)
        : Math.abs(valorInfo.value);

    const category = inferirCategoria(description);
    const parcela = extrairParcelaDaDescricao(description);
    transacoes.push({
      date,
      description,
      amount,
      type,
      ...(category ? { category } : {}),
      ...(parcela ? { parcela_numero: parcela.numero, parcela_total: parcela.total } : {}),
    });
  }

  // Não deduplicar por (data, descrição, valor): extratos podem ter vários lançamentos
  // idênticos no mesmo dia (ex.: dois SISPAG do mesmo valor).
  return transacoes;
}

/**
 * Encontra a próxima data de lançamento (dd/mm/yyyy ou dd/mm/yy) no texto.
 * Exige ano 4 dígitos ou 2 dígitos seguido de espaço/fim, para não confundir com "28/02 09:47".
 */
function indexOfNextDate(text: string): number {
  const match = text.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})\b|(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2})(?=\s|$)/);
  return match ? match.index ?? -1 : -1;
}

/**
 * Fallback: quando o texto vem colado (ex.: "375,53 (+)Saldo Anterior 02/03/2026"),
 * a descrição fica depois do valor. Busca valor (+)/(-), data anterior e descrição após o valor.
 */
function parseExtratoTextoFallback(texto: string): TransacaoExtrato[] {
  const normalized = texto.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const transacoes: TransacaoExtrato[] = [];

  const valorComSinalRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*[\(\[]?\s*([+-])\s*[\)\]]?/g;
  const dataRegex = /(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/g;

  let m: RegExpExecArray | null;
  while ((m = valorComSinalRegex.exec(normalized)) !== null) {
    const valueStr = m[1];
    const sign = m[2] === "+" ? "+" : "-";
    const value = parseValorBrasileiro(valueStr);
    if (value === null) continue;

    const posValor = m.index;
    const fimValor = posValor + m[0].length;
    const antesValor = normalized.substring(0, posValor);
    const depoisValor = normalized.substring(fimValor);

    let lastDate: string | null = null;
    let lastDateEnd = -1;
    let dataMatch: RegExpExecArray | null;
    dataRegex.lastIndex = 0;
    while ((dataMatch = dataRegex.exec(antesValor)) !== null) {
      const [, d, month, y] = dataMatch;
      const year =
        y.length === 2 ? (parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`) : y;
      lastDate = `${year}-${month.padStart(2, "0")}-${d.padStart(2, "0")}`;
      lastDateEnd = dataMatch.index + dataMatch[0].length;
    }
    if (!lastDate || lastDate.length !== 10) continue;

    // Descrição vem depois do valor quando colado: "375,53 (+)Saldo Anterior 02/03/2026"
    const idxProximaData = indexOfNextDate(depoisValor);
    const descAposValor = stripTrailingBalanceSegment(
      (idxProximaData >= 0 ? depoisValor.slice(0, idxProximaData) : depoisValor)
        .trim()
        .replace(/\s+/g, " ")
    ).slice(0, 200);
    const descAntesValor = antesValor.substring(lastDateEnd).trim().replace(/\s+/g, " ").slice(0, 200);
    const descPart = descAposValor || descAntesValor;
    const description = limparDescricao(descPart || "Movimentação");
    if (shouldSkipDescription(description)) continue;
    if (shouldSkipBalanceContext(description)) continue;
    if (description.replace(/\s+/g, "").toUpperCase() === "SALDO") continue;
    if (description.replace(/\s+/g, " ").toUpperCase().trim() === "SALDO DO DIA") continue;

    const type = sign === "+" ? "credit" : "debit";
    const amount = type === "debit" ? -Math.abs(value) : Math.abs(value);
    const category = inferirCategoria(description);
    const parcela = extrairParcelaDaDescricao(description);

    transacoes.push({
      date: lastDate,
      description,
      amount,
      type,
      ...(category ? { category } : {}),
      ...(parcela ? { parcela_numero: parcela.numero, parcela_total: parcela.total } : {}),
    });
  }

  return transacoes;
}

/**
 * Extrai apenas a seção "Lançamentos" do extrato (ex.: BB), até "Informações Adicionais"
 * ou "Lançamentos Futuros". Se não achar a seção, retorna o texto inteiro.
 *
 * Importante: não usar o rodapé "Lançamentos Futuros" como início da seção — em extratos
 * SICOOB só existe esse trecho com a palavra "Lançamentos", e cortaria o extrato inteiro.
 */
function extrairSecaoLancamentos(texto: string): string {
  const inicioSecao = /\bLan[çc]amentos\b(?!\s+Futuros)/i;
  const lancamentosMatch = texto.match(inicioSecao);
  if (!lancamentosMatch) return texto;

  const start = lancamentosMatch.index ?? 0;
  const depoisLancamentos = texto.slice(start);

  const fimMatch = depoisLancamentos.match(
    /\b(Informa[çc][oõ]es\s+Adicionais|Lan[çc]amentos\s+Futuros|Informa[çc][oõ]es\s+Complementares)\b/i
  );
  const end = fimMatch ? fimMatch.index ?? depoisLancamentos.length : depoisLancamentos.length;
  const bloco = depoisLancamentos.slice(0, end).trim();

  const semCabecalho = bloco.replace(/^Lan[çc]amentos\s*/i, "").replace(/^Dia\s+[\s\S]*?Valor\s*/i, "").trim();
  const out = semCabecalho || bloco;
  if (!out) return texto;
  return out;
}

/**
 * Corta antes de "Lançamentos Futuros": no SICOOB/BB o PDF cola agendamentos futuros e texto
 * jurídico (limites de crédito, SAC, ouvidoria) — não são lançamentos efetivados no período.
 */
function cortarAntesLancamentosFuturos(texto: string): string {
  const re = /\blan[çc]amentos\s+futuros\b/i;
  const m = re.exec(texto);
  if (!m) return texto;
  return texto.slice(0, m.index).trimEnd();
}

/**
 * Parser genérico para extratos em que cada transação começa com data (dd/mm/yyyy) e termina
 * com valor e saldo (ex.: Sicredi: "05/02/2026 DESCRICAO ... -534,00 5.016,89").
 * Usa o penúltimo número como valor da transação e o último como saldo (ignorado).
 */
function parseExtratoPorDataNoInicio(texto: string): TransacaoExtrato[] {
  const normalized = texto.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const transacoes: TransacaoExtrato[] = [];
  const dataRegex = /(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})\b/g;
  const valorRegex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;

  let match: RegExpExecArray | null;
  const indicesData: number[] = [];
  while ((match = dataRegex.exec(normalized)) !== null) {
    indicesData.push(match.index);
  }

  for (let i = 0; i < indicesData.length; i++) {
    const start = indicesData[i];
    const end = i + 1 < indicesData.length ? indicesData[i + 1] : normalized.length;
    const chunk = normalized.slice(start, end).trim();
    const dataMatch = chunk.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);
    if (!dataMatch) continue;

    const [, d, m, y] = dataMatch;
    const year = y.length === 2 ? (parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`) : y;
    const date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (date.length !== 10) continue;

    const resto = chunk.slice(dataMatch[0].length).trim();
    const numeros: { value: number; index: number }[] = [];
    let vm: RegExpExecArray | null;
    valorRegex.lastIndex = 0;
    while ((vm = valorRegex.exec(resto)) !== null) {
      const n = parseValorBrasileiro(vm[1]);
      if (n !== null) numeros.push({ value: n, index: vm.index });
    }
    if (numeros.length === 0) continue;

    const amountValue = numeros.length >= 2 ? numeros[numeros.length - 2].value : numeros[numeros.length - 1].value;
    const indexDoValor = numeros.length >= 2 ? numeros[numeros.length - 2].index : numeros[numeros.length - 1].index;
    const descPart = resto.slice(0, indexDoValor).trim().replace(/\s+/g, " ").slice(0, 200);
    const description = limparDescricao(descPart || "Movimentação");
    if (shouldSkipDescription(description)) continue;
    if (shouldSkipBalanceContext(description)) continue;
    if (descPart.length < 2) continue;

    const type: "credit" | "debit" = amountValue >= 0 ? "credit" : "debit";
    const amount = type === "debit" ? -Math.abs(amountValue) : Math.abs(amountValue);
    const category = inferirCategoria(description);
    const parcela = extrairParcelaDaDescricao(description);

    transacoes.push({
      date,
      description,
      amount,
      type,
      ...(category ? { category } : {}),
      ...(parcela ? { parcela_numero: parcela.numero, parcela_total: parcela.total } : {}),
    });
  }

  return transacoes;
}

/**
 * Parse com fallback: tenta vários formatos (BB com Lançamentos, texto colado com (+)/(-),
 * e formato genérico com data no início da linha e valor/saldo no fim — ex.: Sicredi).
 */
export function parseExtratoTextoComFallback(texto: string): TransacaoExtrato[] {
  const textoBase = cortarAntesLancamentosFuturos(texto);
  const soLancamentos = extrairSecaoLancamentos(textoBase);
  const fallback = parseExtratoTextoFallback(soLancamentos);
  const porLinhas = parseExtratoTexto(soLancamentos); // expande blob (ex.: SICOOB 1 linha → várias)

  const resultado: TransacaoExtrato[] =
    fallback.length >= porLinhas.length ? fallback : porLinhas;

  if (resultado.length === 0) {
    const porDataNoInicio = parseExtratoPorDataNoInicio(textoBase);
    if (porDataNoInicio.length > 0) return porDataNoInicio;
  }

  return resultado;
}

/**
 * Converte transações para CSV (tabela), facilitando leitura e importação em planilhas.
 * Colunas: Data, Descrição, Valor, Tipo, Categoria, Parcela.
 */
export function transacoesParaCSV(transacoes: TransacaoExtrato[]): string {
  const escape = (s: string) => {
    const t = String(s).replace(/"/g, '""');
    return t.includes(",") || t.includes("\n") || t.includes('"') ? `"${t}"` : t;
  };
  const header = "Data,Descrição,Valor,Tipo,Categoria,Parcela";
  const rows = transacoes.map((t) => {
    const parcela =
      t.parcela_numero != null && t.parcela_total != null
        ? `${t.parcela_numero}/${t.parcela_total}`
        : "";
    return [
      t.date,
      escape(t.description),
      t.amount.toFixed(2).replace(".", ","),
      t.type === "credit" ? "Crédito" : "Débito",
      escape(t.category ?? ""),
      parcela,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/**
 * Versão de debug: retorna cada etapa do pipeline (linhas brutas, após merge, após expandir, transações).
 * Útil para inspecionar como o PDF é interpretado e padronizar o reconhecimento.
 */
export function parseExtratoTextoDebug(texto: string): {
  rawLines: string[];
  afterMerge: string[];
  afterExpand: string[];
  transacoes: TransacaoExtrato[];
} {
  const rawLines = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const afterMerge = juntarLinhasContinuacao(rawLines);
  const afterExpand = expandirLinhasComMultiplasTransacoes(afterMerge);
  const transacoes = parseExtratoTexto(texto); // usa o fluxo completo (merge + expand interno)

  return { rawLines, afterMerge, afterExpand, transacoes };
}
