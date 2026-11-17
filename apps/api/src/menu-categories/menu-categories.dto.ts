import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';

// SPEC/2026-11-16-categorias-do-cardapio.md. Os campos são conferidos também no serviço, com as mensagens das regras.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMenuCategoryDto {
  @Transform(trim) @IsString() @Length(2, 50) name: string;
}

export class UpdateMenuCategoryDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 50) name?: string;
}

export class ReorderMenuCategoriesDto {
  @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) ids: number[];
}

export class AssignMenuCategoryDto {
  @ValidateIf((dto: AssignMenuCategoryDto) => dto.categoryId !== null) @Type(() => Number) @IsInt() @Min(1) categoryId: number | null;
}
