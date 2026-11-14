import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Valor monetário: número finito, maior que zero e com no máximo duas casas.
 * A mensagem é a mesma do frontend, para que a mesma ação mostre a mesma
 * mensagem nos dois modos de operação.
 */
export function IsMoney(message = 'Informe um valor válido.', options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMoney',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          const number = Number(value);
          if (!Number.isFinite(number) || number <= 0) return false;
          const cents = number * 100;
          return Math.abs(cents - Math.round(cents)) < 1e-6;
        },
        defaultMessage(args: ValidationArguments) {
          return message;
        },
      },
    });
  };
}
