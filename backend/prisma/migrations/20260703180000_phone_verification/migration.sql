ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "PhoneVerificationChallenge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneVerificationChallenge_userId_idx" ON "PhoneVerificationChallenge"("userId");
CREATE INDEX "PhoneVerificationChallenge_expiresAt_idx" ON "PhoneVerificationChallenge"("expiresAt");

ALTER TABLE "PhoneVerificationChallenge" ADD CONSTRAINT "PhoneVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
