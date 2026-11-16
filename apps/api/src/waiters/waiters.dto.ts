import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MAX_COMMISSION } from './waiter-rules';

// SPEC/2026-11-16-garcons-e-comissao.md. A taxa é conferida também no serviço, com a mensagem da regra.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateWaiterDto {
  @Transform(trim) @IsString() @Length(2, 80) name: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_COMMISSION) commissionRate?: number;
}

export class UpdateWaiterDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_COMMISSION) commissionRate?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class AssignWaiterDto {
  @Type(() => Number) @IsInt() @Min(1) waiterId: number;
}
