import { NextResponse } from "next/server";
import { JournalError } from "./journal";

/** JournalError → 400 dengan pesan; error lain dilempar ulang. */
export function journalErrorResponse(error: unknown) {
  if (error instanceof JournalError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  throw error;
}
