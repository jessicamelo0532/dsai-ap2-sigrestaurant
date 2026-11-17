import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

// SPEC/2026-11-17-zonas-do-salao.md. O nome é conferido também no serviço, com a mensagem da regra.
export class ZoneNameDto {
  @IsString({ message: 'Informe o nome da zona, de 2 a 40 caracteres.' }) name: string;
}

export class MoveTableDto {
  @Type(() => Number) @IsInt({ message: 'Zona não encontrada.' }) @Min(1, { message: 'Zona não encontrada.' }) zoneId: number;
}
