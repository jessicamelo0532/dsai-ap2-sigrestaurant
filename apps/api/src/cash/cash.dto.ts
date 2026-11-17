import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, MaxLength, Min, ValidateNested } from 'class-validator';

// SPEC/2026-11-16-caixa-por-turno.md. Valores e textos são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class OpenCashDto {
  @Transform(trim) @IsString() @Length(2, 80) operator: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) openingAmount: number;
}

export class CashMovementDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) amount: number;
  @Transform(trim) @IsString() @Length(3, 200) reason: string;
}

export class CountedDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) CASH: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) CREDIT: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) DEBIT: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) PIX: number;
}

export class CloseCashDto {
  @Transform(trim) @IsString() @Length(2, 80) operator: string;
  @ValidateNested() @Type(() => CountedDto) counted: CountedDto;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}
