import { Transform } from "class-transformer";
import { Equals, IsBoolean } from "class-validator";

export class LocationCandidatesRequestDto {
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  })
  @IsBoolean()
  @Equals(true, {
    message: "confirmPaidRequest deve ser true para autorizar uma consulta individual ao Google Places",
  })
  confirmPaidRequest!: boolean;
}
