-- CreateTable
CREATE TABLE "MomNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meetingDate" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MomNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MomNote_meetingDate_idx" ON "MomNote"("meetingDate");

-- CreateIndex
CREATE INDEX "MomNote_createdBy_idx" ON "MomNote"("createdBy");
