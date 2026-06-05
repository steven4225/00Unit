import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message: "Summary route reserved for a future PR."
    },
    {
      status: 501
    }
  );
}
