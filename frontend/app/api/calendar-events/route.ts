import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getAccessToken() {
  const session = await getServerSession(authOptions);
  return session?.accessToken;
}

export async function GET(request: Request) {
  const accessToken = await getAccessToken();
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  if (!start || !end) {
    return NextResponse.json({ detail: "Start and end are required" }, { status: 400 });
  }

  const response = await fetch(`${API_URL}/calendar/?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: Request) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const response = await fetch(`${API_URL}/calendar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}
