import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { IsMoney } from './validators';

export class CreateTableDto {
  @Type(() => Number)
  @IsInt({ message: 'Informe um número de mesa válido.' })
  @Min(1, { message: 'Informe um número de mesa válido.' })
  @Max(9999, { message: 'Informe um número de mesa válido.' })
  number: number;

  @Type(() => Number)
  @IsInt({ message: 'Informe uma quantidade de lugares válida.' })
  @Min(1, { message: 'Informe uma quantidade de lugares válida.' })
  @Max(100, { message: 'Informe uma quantidade de lugares válida.' })
  capacity = 4;
}

export class CreateMenuItemDto {
  @IsString({ message: 'Informe o nome do item.' })
  @IsNotEmpty({ message: 'Informe o nome do item.' })
  @MaxLength(100, { message: 'O nome do item deve ter no máximo 100 caracteres.' })
  name: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;

  @Type(() => Number)
  @IsMoney('Informe um preço válido.')
  price: number;

  @IsOptional() @Type(() => Boolean) @IsBoolean() available?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString({ message: 'Informe o nome do item.' })
  @IsNotEmpty({ message: 'Informe o nome do item.' })
  @MaxLength(100, { message: 'O nome do item deve ter no máximo 100 caracteres.' })
  name?: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsMoney('Informe um preço válido.')
  price?: number;

  @IsOptional() @Type(() => Boolean) @IsBoolean() available?: boolean;
}

export class AddOrderItemDto {
  @Type(() => Number) @IsInt({ message: 'Informe o item do cardápio.' }) @Min(1, { message: 'Informe o item do cardápio.' }) menuItemId: number;

  @Type(() => Number)
  @IsInt({ message: 'Informe uma quantidade entre 1 e 500.' })
  @Min(1, { message: 'Informe uma quantidade entre 1 e 500.' })
  @Max(500, { message: 'Informe uma quantidade entre 1 e 500.' })
  quantity: number;

  // SPEC/2026-11-16-variacoes-e-adicionais.md (RF-03)
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) variantId?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true }) addonIds?: number[];
}

export class UpdateOrderItemDto {
  @Type(() => Number)
  @IsInt({ message: 'Informe uma quantidade entre 1 e 500.' })
  @Min(1, { message: 'Informe uma quantidade entre 1 e 500.' })
  @Max(500, { message: 'Informe uma quantidade entre 1 e 500.' })
  quantity: number;
}

export class CloseOrderDto {
  @IsEnum(PaymentMethod, { message: 'Selecione uma forma de pagamento válida.' }) paymentMethod: PaymentMethod;
}

export class CreateExpenseDto {
  @IsString({ message: 'Informe a descrição da despesa.' })
  @IsNotEmpty({ message: 'Informe a descrição da despesa.' })
  @MaxLength(160, { message: 'A descrição da despesa deve ter no máximo 160 caracteres.' })
  description: string;

  @Type(() => Number)
  @IsMoney('Informe um valor válido.')
  amount: number;

  @IsOptional() @IsString() incurredAt?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString({ message: 'Informe a descrição da despesa.' })
  @IsNotEmpty({ message: 'Informe a descrição da despesa.' })
  @MaxLength(160, { message: 'A descrição da despesa deve ter no máximo 160 caracteres.' })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsMoney('Informe um valor válido.')
  amount?: number;

  @IsOptional() @IsString() incurredAt?: string;
}
