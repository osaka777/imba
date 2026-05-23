import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Декоратор для извлечения информации о пользователе из запроса
 * @param data - Ключ для извлечения конкретного поля из объекта пользователя
 * @param ctx - Контекст выполнения
 * @returns Объект пользователя или конкретное поле из объекта пользователя
 */
export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);