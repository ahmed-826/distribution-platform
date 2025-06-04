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

export const getUserId = () => {
  return "b68d0a1c-0098-4bce-8498-bef23be977e9";
};

export const getUserRole = async (id) => {
  const { role } = await prisma.user.findUnique({ where: { id } });
  return role;
};

export const calculateFileHash = (fileData) => {
  return crypto.createHash("sha256").update(fileData).digest("hex");
};
