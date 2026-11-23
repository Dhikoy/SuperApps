CREATE TABLE "AttendanceIssueReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confirmedCause" TEXT,
    "notes" TEXT,
    "followUp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BELUM_DIKONFIRMASI',
    "reviewerNik" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceIssueReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AttendanceIssueReview_period_userId_key"
ON "AttendanceIssueReview"("period", "userId");

CREATE INDEX "AttendanceIssueReview_period_status_idx"
ON "AttendanceIssueReview"("period", "status");

CREATE INDEX "AttendanceIssueReview_userId_idx"
ON "AttendanceIssueReview"("userId");
