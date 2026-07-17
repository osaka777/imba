ALTER TABLE "User"
ADD COLUMN "telegramNotifyPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "telegram2faEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "avatarPreset" TEXT;

CREATE TABLE "UserTrustedDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTrustedDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "requestIp" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramNotificationLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "telegramUserId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTrustedDevice_userId_deviceId_key" ON "UserTrustedDevice"("userId", "deviceId");
CREATE INDEX "UserTrustedDevice_userId_idx" ON "UserTrustedDevice"("userId");
CREATE INDEX "TelegramLoginChallenge_userId_idx" ON "TelegramLoginChallenge"("userId");
CREATE INDEX "TelegramLoginChallenge_expiresAt_idx" ON "TelegramLoginChallenge"("expiresAt");
CREATE INDEX "TelegramNotificationLog_userId_idx" ON "TelegramNotificationLog"("userId");
CREATE INDEX "TelegramNotificationLog_createdAt_idx" ON "TelegramNotificationLog"("createdAt");
CREATE INDEX "TelegramNotificationLog_type_status_idx" ON "TelegramNotificationLog"("type", "status");

ALTER TABLE "UserTrustedDevice" ADD CONSTRAINT "UserTrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLoginChallenge" ADD CONSTRAINT "TelegramLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationLog" ADD CONSTRAINT "TelegramNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User"
ADD COLUMN "telegramNotifyPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "telegram2faEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "avatarPreset" TEXT;

CREATE TABLE "UserTrustedDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTrustedDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "requestIp" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramNotificationLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "telegramUserId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTrustedDevice_userId_deviceId_key" ON "UserTrustedDevice"("userId", "deviceId");
CREATE INDEX "UserTrustedDevice_userId_idx" ON "UserTrustedDevice"("userId");
CREATE INDEX "TelegramLoginChallenge_userId_idx" ON "TelegramLoginChallenge"("userId");
CREATE INDEX "TelegramLoginChallenge_expiresAt_idx" ON "TelegramLoginChallenge"("expiresAt");
CREATE INDEX "TelegramNotificationLog_userId_idx" ON "TelegramNotificationLog"("userId");
CREATE INDEX "TelegramNotificationLog_createdAt_idx" ON "TelegramNotificationLog"("createdAt");
CREATE INDEX "TelegramNotificationLog_type_status_idx" ON "TelegramNotificationLog"("type", "status");

ALTER TABLE "UserTrustedDevice" ADD CONSTRAINT "UserTrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLoginChallenge" ADD CONSTRAINT "TelegramLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationLog" ADD CONSTRAINT "TelegramNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
