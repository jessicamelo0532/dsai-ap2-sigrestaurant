import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateTableDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(9999) number: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) capacity = 4;
}

export class CreateMenuItemDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) price: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() available?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) price?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() available?: boolean;
}

export class AddOrderItemDto {
  @Type(() => Number) @IsInt() @Min(1) menuItemId: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) quantity: number;
}

export class UpdateOrderItemDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(500) quantity: number;
}

export class CloseOrderDto {
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
}

export class CreateExpenseDto {
  @IsString() @IsNotEmpty() @MaxLength(160) description: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsOptional() @IsString() incurredAt?: string;
}
