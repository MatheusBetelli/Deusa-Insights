import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from "class-validator";
import { TARGET_OPPORTUNITY_CNAES } from "../../common/opportunity-filter";

export class ImportCnpjDto {
  @IsString()
  @Length(2, 2)
  uf!: string;

  @IsString()
  @MaxLength(120)
  cityName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  cityIbgeCode?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.replace(/\D/g, "") : value))
  @IsIn(Array.from(TARGET_OPPORTUNITY_CNAES), {
    message: "cnaeCode está fora do escopo comercial autorizado",
  })
  cnaeCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit!: number;
}
