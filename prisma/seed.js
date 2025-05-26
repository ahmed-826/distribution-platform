const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  // Create Users
  const superAdmin = await prisma.user.create({
    data: {
      username: "superAdmin",
      role: "superAdmin",
      password:
        "eb7182740cdd26a3603bb0c97881da901439d8d869bdb58befa058f340d61577", // super@password
    },
  });

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      role: "admin",
      password:
        "8199f0b4cb25258cf04e1126565a4b55133189517020d24ce49c7644c336f278", // admin@password
      createdById: superAdmin.id,
    },
  });

  const user = await prisma.user.create({
    data: {
      username: "user",
      role: "user",
      password:
        "096da02598c4990cec9a8762d22fe4d53d1092293c7523a0e332092932a56a72", // user@password
      createdById: admin.id,
    },
  });
}

main()
  .then(() => {
    console.log(`${"\x1b[32m"}Seed.js was executed successfully!${"\x1b[0m"}`);
  })
  .catch((e) => console.error(e.message))
  .finally(async () => await prisma.$disconnect());
