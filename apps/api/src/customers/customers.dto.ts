import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength, Min, ValidateIf } from 'class-validator';

// SPEC/2026-11-16-clientes-e-historico.md. Os campos são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCustomerDto {
  @Transform(trim) @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) notes?: string | null;
}

export class UpdateCustomerDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class AssignCustomerDto {
  @ValidateIf((dto: AssignCustomerDto) => dto.customerId !== null) @Type(() => Number) @IsInt() @Min(1) customerId: number | null;
}
