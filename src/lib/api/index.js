import prisma from "@/lib/db";

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
  return "0f1601c2-d523-4b90-beb2-0e1f600ff371";
};

export const getUserRole = async (id) => {
  const { role } = await prisma.user.findUnique({ where: { id } });
  return role;
};
