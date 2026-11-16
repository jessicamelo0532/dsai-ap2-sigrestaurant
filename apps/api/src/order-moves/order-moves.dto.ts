import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

// SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md. O motivo é conferido também no serviço (RN-06).
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class TransferOrderDto {
  @Type(() => Number) @IsInt() @Min(1) tableId: number;
  @Transform(trim) @IsString() @Length(3, 200) reason: string;
}

export class MergeOrderDto {
  @Type(() => Number) @IsInt() @Min(1) sourceOrderId: number;
  @Transform(trim) @IsString() @Length(3, 200) reason: string;
}
