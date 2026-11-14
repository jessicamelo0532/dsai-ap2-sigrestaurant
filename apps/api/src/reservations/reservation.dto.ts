import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from './reservation-rules';

// RN-10 da SPEC/2026-11-12-reservas-de-mesa.md
const PHONE = /^[0-9()+\s-]{8,20}$/;
const PHONE_MESSAGE = 'Telefone deve ter de 8 a 20 caracteres entre dígitos, espaço, +, - e parênteses.';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateReservationDto {
  @Type(() => Number) @IsInt() @Min(1) tableId: number;
  @Transform(trim) @IsString() @Length(2, 100) customerName: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(PHONE, { message: PHONE_MESSAGE }) customerPhone?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) partySize: number;
  @IsString() startsAt: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(MIN_DURATION_MINUTES) @Max(MAX_DURATION_MINUTES)
  durationMinutes?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}

// Remarcação: todos os campos são opcionais; os ausentes ficam como estão.
export class UpdateReservationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) tableId?: number;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 100) customerName?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(PHONE, { message: PHONE_MESSAGE }) customerPhone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) partySize?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(MIN_DURATION_MINUTES) @Max(MAX_DURATION_MINUTES)
  durationMinutes?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}
