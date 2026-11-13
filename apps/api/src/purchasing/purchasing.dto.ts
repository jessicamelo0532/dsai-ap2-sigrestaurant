import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_PURCHASE_ITEMS } from './purchase-rules';

// SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md. Sinais, casas decimais, datas e
// CPF/CNPJ são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupplierDto {
  @Transform(trim) @IsString() @Length(2, 100) name: string;
  @IsOptional() @IsString() @MaxLength(20) document?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @Transform(trim) @IsEmail({}, { message: 'E-mail inválido.' }) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(20) document?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @Transform(trim) @IsEmail({}, { message: 'E-mail inválido.' }) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PurchaseItemDto {
  @Type(() => Number) @IsInt() @Min(1) ingredientId: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) quantity: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) unitCost: number;
}

export class CreatePurchaseDto {
  @Type(() => Number) @IsInt() @Min(1) supplierId: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) invoiceNumber?: string;
  @IsOptional() @IsString() purchasedAt?: string;
  @IsString() dueDate: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PURCHASE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

export class PayPurchaseDto {
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() paidAt?: string;
}
