import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

// SPEC/2026-11-16-variacoes-e-adicionais.md. Nomes e preços são conferidos no serviço, com as mensagens das regras.
export class MenuOptionDto {
  @IsString() name: string;
  price: number | string;
}

export class SetMenuOptionsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => MenuOptionDto) variants?: MenuOptionDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => MenuOptionDto) addons?: MenuOptionDto[];
}
