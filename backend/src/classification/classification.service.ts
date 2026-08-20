import { Injectable } from '@nestjs/common';
import { Company, CompanyDetails } from '@prisma/client';
import { isValidOpportunityCnae } from '../common/opportunity-filter';

export interface CompanyClassification {
  type: string;
  size: string;
  region: string;
  score: number;
  potentialLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class ClassificationService {
  classifyCompany(
    company: Company & {
      details?: CompanyDetails | null;
      cnaes?: Array<{ cnaeCode: string }>;
    },
  ): CompanyClassification {
    const targetCnae = isValidOpportunityCnae(company.cnaePrincipal)
      ? company.cnaePrincipal
      : company.cnaes?.find((item) => isValidOpportunityCnae(item.cnaeCode))?.cnaeCode;
    const type = this.determineType(targetCnae);
    const size = this.determineSize(company.porte);
    const region = this.determineRegion(company.cidade, company.uf);
    const score = this.calculateScore(type, size, company);
    const potentialLevel = this.determinePotential(score);

    return {
      type,
      size,
      region,
      score,
      potentialLevel,
    };
  }

  private determineType(cnae: string | null | undefined): string {
    if (!cnae) return 'Fora do escopo';
    const c = cnae.replace(/\D/g, '');
    if (c === '4711301') return 'Hipermercado';
    if (c === '4711302') return 'Supermercado';
    if (c === '4712100') return 'Minimercado';
    if (c === '4721102') return 'Mercearia';
    if (c === '4722901') return 'Açougue';
    return 'Fora do escopo';
  }

  private determineSize(porte: string | null): string {
    if (!porte) return 'Médio';
    const p = porte.toLowerCase();
    if (p.includes('micro') || p.includes('me') || p.includes('pequeno')) return 'Pequeno';
    if (p.includes('médio') || p.includes('epp')) return 'Médio';
    if (p.includes('grande') || p.includes('demais')) return 'Grande';
    return 'Médio';
  }

  private determineRegion(cidade: string, uf: string): string {
    if (['SP', 'RJ', 'MG', 'PR', 'RS', 'SC'].includes(uf)) {
      if (['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'].includes(cidade)) {
        return 'Capital Estratégica';
      }
      return 'Região Sul/Sudeste';
    }
    return `${cidade} / ${uf}`;
  }

  private calculateScore(type: string, size: string, company: Company): number {
    if (type === 'Fora do escopo') return 0;
    let score = 50;

    // Pontuação por tipo
    if (type === 'Hipermercado' || type === 'Supermercado') score += 20;
    else if (type === 'Minimercado' || type === 'Mercearia' || type === 'Açougue') score += 10;

    // Pontuação por porte
    if (size === 'Grande') score += 15;
    else if (size === 'Médio') score += 5;

    // Bônus se tiver dados verificados
    if (company.statusVerificacaoEndereco === 'confiavel_cadastralmente' || company.statusVerificacaoEndereco === 'verificado') {
      score += 10;
    }

    if (company.situacaoCadastral === 'ATIVA') score += 5;

    return Math.min(100, Math.max(0, score));
  }

  private determinePotential(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= 75) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  }
}
