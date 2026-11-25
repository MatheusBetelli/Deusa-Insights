import { GoneException, Injectable } from "@nestjs/common";
import type { CnpjProvider } from "./cnpj-provider.interface";

@Injectable()
export class ReceitaFederalProvider implements CnpjProvider {
  getCompanyByCnpj(): never {
    throw new GoneException("A sincronização por CSV foi encerrada. Consulte a carteira existente.");
  }
}
