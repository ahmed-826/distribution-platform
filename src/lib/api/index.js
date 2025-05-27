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
  return "6bd05a61-87d5-401c-8453-70eee3984beb";
};

export const getUserRole = async (id) => {
  const { role } = await prisma.user.findUnique({ where: { id } });
  return role;
};
