import { NextResponse } from "next/server";

export default async function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
