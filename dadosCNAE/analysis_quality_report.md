# Relatório de Qualidade da Base — Receita Federal
**Gerado em:** 2026-07-05
**Fonte:** CSV ESTABELE — CNAE 4712100 (Minimercados, Mercearias e Armazéns) — Estado de SP

---

## 1. Totais Gerais

| Métrica | Valor |
|---|---|
| Total de registros lidos | 23.348 |
| Total de registros processados (únicos) | 23.348 |
| CNPJs duplicados ignorados | 0 |
| CNPJs com dígito verificador inválido | 0 |

## 2. Por Situação Cadastral

| Situação | Quantidade |
|---|---|
| ATIVA | 4.031 |
| BAIXADA | 14.375 |
| INAPTA | 4.778 |
| SUSPENSA | 115 |
| NULA | 49 |
| DESCONHECIDA | 0 |

## 3. Completude dos Dados

| Campo | Sem preenchimento |
|---|---|
| Nome fantasia | 13.230 |
| Endereço completo | 235 |
| Telefone | 11.015 |
| E-mail | 13.445 |

## 4. Mapeamento Municipal e Coordenadas

| Métrica | Valor |
|---|---|
| Com município mapeado no sistema | 1.100 |
| Com coordenada aproximada (centroide + jitter) | 1.100 |
| Sem coordenada (município não mapeado) | 22.248 |
| Pendentes de validação manual | 23.348 |

## 5. Por Nível de Oportunidade Comercial

| Nível | Quantidade |
|---|---|
| Alta (80–100 pts) | 3.543 |
| Média (50–79 pts) | 9.700 |
| Baixa (0–49 pts) | 10.105 |

## 6. Por Status de Verificação de Endereço

| Status | Quantidade |
|---|---|
| confiavel_cadastralmente | 3.544 |
| aproximado | 13.741 |
| nao_verificado | 6.063 |
| verificado | 0 |
| divergente | 0 |
| nao_encontrado | 0 |

## 7. Top 20 Municípios com Mais Estabelecimentos Ativos

| # | Município | Ativos |
|---|---|---|
| 1 | Municipio 7107 | 904 |
| 2 | Municipio 6291 | 105 |
| 3 | Municipio 6477 | 82 |
| 4 | Municipio 6969 | 60 |
| 5 | Municipio 6789 | 59 |
| 6 | Municipio 7075 | 52 |
| 7 | Municipio SP | 47 |
| 8 | Municipio 7099 | 45 |
| 9 | Municipio 7145 | 43 |
| 10 | Municipio 7057 | 42 |
| 11 | Municipio 6425 | 41 |
| 12 | Municipio 6875 | 40 |
| 13 | Municipio 6713 | 38 |
| 14 | Bauru | 34 |
| 15 | Municipio 6401 | 31 |
| 16 | Municipio 7151 | 30 |
| 17 | Municipio 6921 | 30 |
| 18 | Municipio 7097 | 29 |
| 19 | Municipio 6563 | 29 |
| 20 | Municipio 6689 | 29 |

---

## 8. Como o Mapa Está Sendo Alimentado

O mapa de oportunidades é alimentado com **coordenadas aproximadas por município**, geradas da seguinte forma:

1. Para cada estabelecimento importado, o sistema localiza o centroide geográfico do município (latitude e longitude central da cidade, obtidas de fonte pública).
2. É aplicado um **jitter determinístico baseado no CNPJ**: um pequeno deslocamento fixo (±0,014 graus, ~1,5 km) derivado de um hash do CNPJ. Isso garante que pontos de diferentes estabelecimentos não se sobreponham exatamente e que o mesmo estabelecimento aparece sempre na mesma posição aproximada entre sessões.

**Resultado visual:** Os pontos no mapa se distribuem em uma nuvem ao redor do centro da cidade, criando uma visualização de densidade por município.

## 9. Limitação Atual

> ⚠️ **As coordenadas exibidas no mapa NÃO representam o endereço físico exato de nenhum estabelecimento.**
>
> A base da Receita Federal (layout ESTABELE) não contém campos de latitude e longitude dos estabelecimentos.
> O campo `origemCoordenada = "municipio_centroide_jitter"` identifica esses pontos aproximados.
> O campo `statusVerificacaoEndereco = "aproximado"` reflete essa limitação.
>
> Para obter coordenadas reais, será necessário uma etapa futura de geocodificação via Google Maps API
> ou similar, configurando a variável de ambiente `GOOGLE_MAPS_API_KEY` no backend.

---
*Relatório gerado automaticamente pelo script `npm run quality:report`.*
