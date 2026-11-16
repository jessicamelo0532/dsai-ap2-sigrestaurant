import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

// SPEC/2026-11-16-cardapio-por-horario.md. As janelas são conferidas também no serviço, com as mensagens das regras.
export class AvailabilityWindowDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @IsString() start: string;
  @IsString() end: string;
}

export class SetAvailabilityDto {
  @IsArray() @ArrayMaxSize(28) @ValidateNested({ each: true }) @Type(() => AvailabilityWindowDto) windows: AvailabilityWindowDto[];
}
