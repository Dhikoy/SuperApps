-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramLinkedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkCode_code_key" ON "TelegramLinkCode"("code");
CREATE INDEX "TelegramLinkCode_userId_idx" ON "TelegramLinkCode"("userId");

-- CreateTable
CREATE TABLE "TelegramClockSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'location',
    "jamKerjaId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramClockSession_chatId_key" ON "TelegramClockSession"("chatId");

-- CreateTable
CREATE TABLE "TelegramReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramReminderLog_userId_dateKey_kind_key" ON "TelegramReminderLog"("userId", "dateKey", "kind");
CREATE INDEX "TelegramReminderLog_dateKey_idx" ON "TelegramReminderLog"("dateKey");
