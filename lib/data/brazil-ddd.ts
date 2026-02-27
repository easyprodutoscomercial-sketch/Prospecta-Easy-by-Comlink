/**
 * Mapping of Brazilian DDDs (area codes) to their main city and state.
 * Used to enrich contacts that have phone but no cidade/estado.
 */
export const DDD_TO_LOCATION: Record<string, { cidade: string; estado: string }> = {
  // SAO PAULO (SP)
  "11": { cidade: "São Paulo", estado: "SP" },
  "12": { cidade: "São José dos Campos", estado: "SP" },
  "13": { cidade: "Santos", estado: "SP" },
  "14": { cidade: "Bauru", estado: "SP" },
  "15": { cidade: "Sorocaba", estado: "SP" },
  "16": { cidade: "Ribeirão Preto", estado: "SP" },
  "17": { cidade: "São José do Rio Preto", estado: "SP" },
  "18": { cidade: "Presidente Prudente", estado: "SP" },
  "19": { cidade: "Campinas", estado: "SP" },

  // RIO DE JANEIRO (RJ)
  "21": { cidade: "Rio de Janeiro", estado: "RJ" },
  "22": { cidade: "Campos dos Goytacazes", estado: "RJ" },
  "24": { cidade: "Volta Redonda", estado: "RJ" },

  // ESPIRITO SANTO (ES)
  "27": { cidade: "Vitória", estado: "ES" },
  "28": { cidade: "Cachoeiro de Itapemirim", estado: "ES" },

  // MINAS GERAIS (MG)
  "31": { cidade: "Belo Horizonte", estado: "MG" },
  "32": { cidade: "Juiz de Fora", estado: "MG" },
  "33": { cidade: "Governador Valadares", estado: "MG" },
  "34": { cidade: "Uberlândia", estado: "MG" },
  "35": { cidade: "Pouso Alegre", estado: "MG" },
  "37": { cidade: "Divinópolis", estado: "MG" },
  "38": { cidade: "Montes Claros", estado: "MG" },

  // PARANA (PR)
  "41": { cidade: "Curitiba", estado: "PR" },
  "42": { cidade: "Ponta Grossa", estado: "PR" },
  "43": { cidade: "Londrina", estado: "PR" },
  "44": { cidade: "Maringá", estado: "PR" },
  "45": { cidade: "Foz do Iguaçu", estado: "PR" },
  "46": { cidade: "Pato Branco", estado: "PR" },

  // SANTA CATARINA (SC)
  "47": { cidade: "Joinville", estado: "SC" },
  "48": { cidade: "Florianópolis", estado: "SC" },
  "49": { cidade: "Chapecó", estado: "SC" },

  // RIO GRANDE DO SUL (RS)
  "51": { cidade: "Porto Alegre", estado: "RS" },
  "53": { cidade: "Pelotas", estado: "RS" },
  "54": { cidade: "Caxias do Sul", estado: "RS" },
  "55": { cidade: "Santa Maria", estado: "RS" },

  // DISTRITO FEDERAL (DF)
  "61": { cidade: "Brasília", estado: "DF" },

  // GOIAS (GO)
  "62": { cidade: "Goiânia", estado: "GO" },
  "64": { cidade: "Rio Verde", estado: "GO" },

  // TOCANTINS (TO)
  "63": { cidade: "Palmas", estado: "TO" },

  // MATO GROSSO (MT)
  "65": { cidade: "Cuiabá", estado: "MT" },
  "66": { cidade: "Rondonópolis", estado: "MT" },

  // MATO GROSSO DO SUL (MS)
  "67": { cidade: "Campo Grande", estado: "MS" },

  // ACRE (AC)
  "68": { cidade: "Rio Branco", estado: "AC" },

  // RONDONIA (RO)
  "69": { cidade: "Porto Velho", estado: "RO" },

  // BAHIA (BA)
  "71": { cidade: "Salvador", estado: "BA" },
  "73": { cidade: "Ilhéus", estado: "BA" },
  "74": { cidade: "Juazeiro", estado: "BA" },
  "75": { cidade: "Feira de Santana", estado: "BA" },
  "77": { cidade: "Vitória da Conquista", estado: "BA" },

  // SERGIPE (SE)
  "79": { cidade: "Aracaju", estado: "SE" },

  // PERNAMBUCO (PE)
  "81": { cidade: "Recife", estado: "PE" },
  "87": { cidade: "Petrolina", estado: "PE" },

  // ALAGOAS (AL)
  "82": { cidade: "Maceió", estado: "AL" },

  // PARAIBA (PB)
  "83": { cidade: "João Pessoa", estado: "PB" },

  // RIO GRANDE DO NORTE (RN)
  "84": { cidade: "Natal", estado: "RN" },

  // CEARA (CE)
  "85": { cidade: "Fortaleza", estado: "CE" },
  "88": { cidade: "Juazeiro do Norte", estado: "CE" },

  // PIAUI (PI)
  "86": { cidade: "Teresina", estado: "PI" },
  "89": { cidade: "Picos", estado: "PI" },

  // PARA (PA)
  "91": { cidade: "Belém", estado: "PA" },
  "93": { cidade: "Santarém", estado: "PA" },
  "94": { cidade: "Marabá", estado: "PA" },

  // AMAZONAS (AM)
  "92": { cidade: "Manaus", estado: "AM" },
  "97": { cidade: "Manaus", estado: "AM" },

  // RORAIMA (RR)
  "95": { cidade: "Boa Vista", estado: "RR" },

  // AMAPA (AP)
  "96": { cidade: "Macapá", estado: "AP" },

  // MARANHAO (MA)
  "98": { cidade: "São Luís", estado: "MA" },
  "99": { cidade: "Imperatriz", estado: "MA" },
};

/**
 * Extract DDD from a normalized phone string (digits only).
 * Brazilian phones: DDD (2 digits) + number (8-9 digits).
 * Country code 55 is stripped if present.
 */
export function extractDDD(phoneNormalized: string): string | null {
  if (!phoneNormalized) return null;

  let digits = phoneNormalized;

  // Strip country code 55 if present
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.substring(2);
  }

  // DDD is the first 2 digits
  if (digits.length >= 10) {
    const ddd = digits.substring(0, 2);
    if (DDD_TO_LOCATION[ddd]) return ddd;
  }

  return null;
}
