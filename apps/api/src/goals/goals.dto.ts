import { IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

// SPEC/2026-11-16-metas-de-vendas.md. Os valores são conferidos também no serviço, com as mensagens das regras.
export class SetGoalDto {
  @IsOptional() @ValidateIf((dto: SetGoalDto) => dto.revenue !== null) @IsNumber({ maxDecimalPlaces: 2 }) revenue?: number | null;
  @IsOptional() @ValidateIf((dto: SetGoalDto) => dto.orders !== null) @IsInt() @Min(1) orders?: number | null;
  @IsOptional() @ValidateIf((dto: SetGoalDto) => dto.averageTicket !== null) @IsNumber({ maxDecimalPlaces: 2 }) averageTicket?: number | null;
}
