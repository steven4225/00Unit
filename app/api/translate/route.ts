import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message: "Translation route reserved for a future PR."
    },
    {
      status: 501
    }
  );
}
