const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

const path = require("path");
const { DateTime } = require("luxon");

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

  const date15122022 = new Date("2022-12-15");
  const formatDateForName15122022 = DateTime.fromJSDate(date15122022)
    .setLocale("fr")
    .toFormat("ddMMMMyyyy");
  const formatDateForPath15122022 = DateTime.fromJSDate(date15122022)
    .setLocale("fr")
    .toFormat("yyyyMMdd");
  const uploadByFile_1 = await prisma.upload.create({
    data: {
      name: `${formatDateForName15122022}-file-1`,
      date: date15122022,
      type: "file",
      fileName: "15fiches.zip",
      path: path.join(
        "data",
        "upload",
        formatDateForPath15122022,
        `1-${formatDateForPath15122022}-file.zip`
      ),
      hash: "77a52ab80a2b7218dcb1f4784cc7a0798b9a356dbc55e26529093062187b4b96",
      user: { connect: { id: superAdmin.id } },
    },
  });

  const date10122022 = new Date("2022-12-10");
  const formatDateForName10122022 = DateTime.fromJSDate(date10122022)
    .setLocale("fr")
    .toFormat("ddMMMMyyyy");
  const formatDateForPath10122022 = DateTime.fromJSDate(date10122022)
    .setLocale("fr")
    .toFormat("yyyyMMdd");

  const uploadByFile_2 = await prisma.upload.create({
    data: {
      name: `${formatDateForName10122022}-file-1`,
      date: date10122022,
      type: "file",
      fileName: "10fiches.zip",
      path: path.join(
        "data",
        "upload",
        formatDateForPath10122022,
        `1-${formatDateForPath10122022}-file.zip`
      ),
      hash: "e78170dd9fa686f68a2a736581a71a6fc9b6135a983bcfc337695d9a5a0c76ae",
      user: { connect: { id: admin.id } },
    },
  });

  const uploadByFile_3 = await prisma.upload.create({
    data: {
      name: `${formatDateForName10122022}-file-2`,
      date: date10122022,
      type: "file",
      fileName: "05fiches.zip",
      path: path.join(
        "data",
        "upload",
        formatDateForPath10122022,
        `2-${formatDateForPath10122022}-file.zip`
      ),
      hash: "91e823684e73af8da9db7fb238abc089ff6380783f6bdaa85e0d0794036a6bb7",
      user: { connect: { id: user.id } },
    },
  });

  const uploadByFile_4 = await prisma.upload.create({
    data: {
      name: `${formatDateForName10122022}-form-3`,
      date: date10122022,
      type: "form",
      fileName: "UneFiche.zip",
      path: path.join(
        "data",
        "upload",
        formatDateForPath10122022,
        `3-${formatDateForPath10122022}-form.zip`
      ),
      hash: "b7b74f293fc1df5f791de4ffd8ba733ea13d0c2e95f017aed542f54b7f26ea5e",
      user: { connect: { id: admin.id } },
    },
  });
}

main()
  .then(() => {
    console.log(`${"\x1b[32m"}Seed.js was executed successfully!${"\x1b[0m"}`);
  })
  .catch((e) => console.error(e.message))
  .finally(async () => await prisma.$disconnect());
