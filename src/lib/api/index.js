import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }

  getMessage() {
    return this.message;
  }

  getStatus() {
    return this.status;
  }
}

export const formatErrorResponse = (error) => {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { data: null, error: { message: error.getMessage() } },
      { status: error.getStatus() }
    );
  }

  return NextResponse.json(
    {
      data: null,
      error: { message: "Internal server error" + " ---> " + error.message },
    },
    { status: 500 }
  );
};

export const getUser = async () => {
  const id = "c478b7bb-002b-407c-b69a-fcc060724559";
  const user = await prisma.user.findUnique({
    where: { id },
    include: { permissions: { select: { name: true } } },
  });

  const userId = user.id;
  const permissions = user.permissions.map((p) => p.name);

  return { userId, permissions };
};

export const calculateFileHash = (fileData) => {
  return crypto.createHash("sha256").update(fileData).digest("hex");
};
