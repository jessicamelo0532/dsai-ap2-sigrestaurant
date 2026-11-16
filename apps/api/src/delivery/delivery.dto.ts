import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

// SPEC/2026-11-16-delivery.md. Os campos são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateDeliveryDto {
  @Transform(trim) @IsString() @Length(2, 80) recipient: string;
  @Transform(trim) @IsString() @Length(5, 200) address: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) fee: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customerId?: number;
}

export class UpdateDeliveryDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) recipient?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(5, 200) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) fee?: number;
}
