import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from "class-validator";

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

  @IsString()
  @MaxLength(20)
  cnaeCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit!: number;
}
