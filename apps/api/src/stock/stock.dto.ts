import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { STOCK_UNITS, StockUnit } from './stock-rules';

// Sinal e casas decimais são conferidos também no serviço (stock-rules.ts), com mensagens próprias.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const UNIT_MESSAGE = `Unidade inválida. Use ${STOCK_UNITS.join(', ')}.`;

export class CreateIngredientDto {
  @Transform(trim) @IsString() @Length(2, 80) name: string;
  @IsIn(STOCK_UNITS, { message: UNIT_MESSAGE }) unit: StockUnit;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) minimumQuantity?: number;
}

export class UpdateIngredientDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsIn(STOCK_UNITS, { message: UNIT_MESSAGE }) unit?: StockUnit;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) minimumQuantity?: number;
}

export class StockEntryDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) quantity: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) note?: string;
}

// RF-03: perda exige motivo.
export class StockLossDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) quantity: number;
  @Transform(trim) @IsString() @Length(3, 200) note: string;
}

export class StockCountDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) countedQuantity: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) note?: string;
}

export class RecipeItemDto {
  @Type(() => Number) @IsInt() @Min(1) ingredientId: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) quantity: number;
}

export class SetRecipeDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RecipeItemDto) items: RecipeItemDto[];
}
