import { Injectable } from '@nestjs/common';
import { Company, CompanyDetails } from '@prisma/client';

export interface CompanyClassification {
  type: string;
  size: string;
  region: string;
  score: number;
  potentialLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class ClassificationService {
  classifyCompany(company: Company & { details?: CompanyDetails | null }): CompanyClassification {
    const type = this.determineType(company.cnaePrincipal);
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

  private determineType(cnae: string | null): string {
    if (!cnae) return 'Outro';
    const c = cnae.replace(/\D/g, '');
    if (c.startsWith('47113') || c.startsWith('47121')) return 'Supermercado';
    if (c.startsWith('47130') || c.startsWith('47237')) return 'Mercado';
    if (c.startsWith('47211') || c.startsWith('47212')) return 'Padaria';
    if (c.startsWith('46397') || c.startsWith('46914')) return 'Atacadista';
    if (c.startsWith('46371') || c.startsWith('46389') || c.startsWith('464')) return 'Distribuidor';
    return 'Outro';
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
    let score = 50;

    // Pontuação por tipo
    if (type === 'Supermercado' || type === 'Atacadista') score += 20;
    else if (type === 'Mercado' || type === 'Distribuidor') score += 10;
    else if (type === 'Padaria') score += 5;

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
