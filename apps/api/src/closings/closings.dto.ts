import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

// SPEC/2026-11-16-fechamento-mensal.md. O serviço confere mês e motivo de novo, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CloseMonthDto {
  @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'Informe o mês no formato AAAA-MM.' }) month: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}

export class ReopenMonthDto {
  @Transform(trim) @IsString() @Length(5, 300, { message: 'Informe o motivo da reabertura, de 5 a 300 caracteres.' })
  reason: string;
}
