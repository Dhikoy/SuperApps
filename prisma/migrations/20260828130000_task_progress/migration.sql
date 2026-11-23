CREATE TABLE "TaskProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskProgress_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TaskProgress_taskId_idx" ON "TaskProgress"("taskId");
CREATE INDEX "TaskProgress_authorId_idx" ON "TaskProgress"("authorId");
