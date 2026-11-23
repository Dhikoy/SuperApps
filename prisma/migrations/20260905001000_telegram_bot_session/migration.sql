-- CreateTable
CREATE TABLE "TelegramBotSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBotSession_chatId_key" ON "TelegramBotSession"("chatId");
