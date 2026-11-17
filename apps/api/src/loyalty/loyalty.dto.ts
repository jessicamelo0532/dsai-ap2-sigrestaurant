import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// SPEC/2026-11-16-programa-de-fidelidade.md. Os valores são conferidos também no serviço, com as mensagens das regras.
export class LoyaltySettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) pointsPerReal?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) centsPerPoint?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) minRedeemPoints?: number;
}

export class RedeemPointsDto {
  @Type(() => Number) @IsInt() @Min(1) points: number;
}
