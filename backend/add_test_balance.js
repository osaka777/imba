const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestBalance() {
  console.log('💰 Добавление баланса тестовому пользователю...');

  try {
    // Находим первого пользователя или создаем нового
    let user = await prisma.user.findFirst();

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
        }
      });
    }

    console.log('✅ Пользователь создан/найден:', user.id);

    // Создаем валюту RUB если её нет
    await prisma.currency.upsert({
      where: { isoCode: 'RUB' },
      update: {},
      create: {
        isoCode: 'RUB',
        name: 'Российский рубль'
      }
    });

    // Ищем любой баланс пользователя
    let balance = await prisma.balance.findFirst({
      where: {
        userId: user.id
      }
    });

    if (balance) {
      // Обновляем существующий баланс
      balance = await prisma.balance.update({
        where: { id: balance.id },
        data: { amount: 10000 }
      });
      console.log('✅ Баланс обновлен:', balance.amount.toString(), balance.currencyCode);
    } else {
      console.log('❌ Баланс не найден для пользователя', user.id);
      return;
    }



    // Создаем операцию пополнения
    await prisma.operation.create({
      data: {
        userId: user.id,
        amount: 10000,
        type: 'INCOME',
        source: 'PAYMENT_SYSTEM',
        status: 'SUCCESS',
        currencyCode: balance.currencyCode,
        meta: {
          description: 'Тестовое пополнение для проверки ставок'
        }
      }
    });

    console.log('✅ Операция пополнения создана');
    console.log('\n🎉 Тестовый пользователь готов для ставок!');
    console.log(`User ID: ${user.id}, Balance: 10,000 RUB`);

  } catch (error) {
    console.error('❌ Ошибка при создании тестового баланса:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestBalance();