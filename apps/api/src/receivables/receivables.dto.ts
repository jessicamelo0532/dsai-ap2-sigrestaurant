import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

// SPEC/2026-11-17-contas-a-receber.md. Datas e observação são conferidas no serviço, com as mensagens das regras.
export class SellOnAccountDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customerId?: number;
  @IsString() dueDate: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReceiveDto {
  @IsEnum(PaymentMethod, { message: 'Selecione uma forma de pagamento válida.' }) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() receivedAt?: string;
}
