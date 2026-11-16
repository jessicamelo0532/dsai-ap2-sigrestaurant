import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PRIORITIES } from './kitchen-rules';

// SPEC/2026-11-16-cozinha-kds.md. Os campos são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendToKitchenDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) note?: string;
}

export class KitchenPriorityDto {
  @IsIn(PRIORITIES) priority: string;
  @Transform(trim) @IsString() @Length(2, 80) changedBy: string;
}
