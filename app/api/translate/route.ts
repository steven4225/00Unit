import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { translationRequestSchema } from "../../../lib/schemas/translate";
import { translateSegments } from "../../../lib/openai/translate";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = translationRequestSchema.parse(json);
    const result = await translateSegments(input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid translation request",
          issues: error.issues
        },
        {
          status: 400
        }
      );
    }

    return NextResponse.json(
      {
        error: "Translation request failed"
      },
      {
        status: 500
      }
    );
  }
}
