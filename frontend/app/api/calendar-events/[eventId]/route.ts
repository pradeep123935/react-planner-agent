import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getAccessToken() {
  const session = await getServerSession(authOptions);
  return session?.accessToken;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const accessToken = await getAccessToken();
  const { eventId } = await params;

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const response = await fetch(`${API_URL}/calendar/${eventId}`, {
    method: "PATCH",
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const accessToken = await getAccessToken();
  const { eventId } = await params;

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/calendar/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}
