import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { summarizeTranscript } from "../../../lib/llm/summarize";
import { summaryRequestSchema } from "../../../lib/schemas/summarize";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = summaryRequestSchema.parse(json);
    const result = await summarizeTranscript(input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid summary request",
          issues: error.issues
        },
        {
          status: 400
        }
      );
    }

    return NextResponse.json(
      {
        error: "Summary request failed"
      },
      {
        status: 500
      }
    );
  }
}
