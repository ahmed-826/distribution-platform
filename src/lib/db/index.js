import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient({
  omit: {
    user: {
      id: true,
      password: true,
    },
    upload: { userId: true },
  },
});

export default prisma;
