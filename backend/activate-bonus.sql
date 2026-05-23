-- Активация бонусного счета для тестирования
UPDATE "bonusBalance" 
SET 
  "isActive" = true, 
  amount = 1000,
  "updatedAt" = NOW()
WHERE 
  "userId" = 1 
  AND "currencyCode" = 'KZT';

-- Проверка результата
SELECT 
  "userId", 
  "currencyCode", 
  amount, 
  "isActive",
  "isTokenBased"
FROM "bonusBalance" 
WHERE "userId" = 1 AND "currencyCode" = 'KZT';
