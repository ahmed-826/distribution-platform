const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();
const crypto = require("crypto");
const { consoleLog } = require("../helper/consoleColors");

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

async function main() {
  // --- PERMISSIONS
  const canGetAllUploads = await prisma.permission.create({
    data: {
      name: "CAN_GET_ALL_UPLOADS",
      description: "Permission to get all uploads",
    },
  });
  const canGetOwnUploads = await prisma.permission.create({
    data: {
      name: "CAN_GET_OWN_UPLOADS",
      description: "Permission to get own uploads",
    },
  });
  const canCreateUpload = await prisma.permission.create({
    data: {
      name: "CAN_CREATE_UPLOAD",
      description: "Permission to create uploads",
    },
  });
  const canCreateUploadByForm = await prisma.permission.create({
    data: {
      name: "CAN_CREATE_UPLOAD_BY_FORM",
      description: "Permission to create uploads by form",
    },
  });
  const canCreateUploadByFile = await prisma.permission.create({
    data: {
      name: "CAN_CREATE_UPLOAD_BY_FILE",
      description: "Permission to create uploads by file",
    },
  });
  const canUpdateAllUploads = await prisma.permission.create({
    data: {
      name: "CAN_UPDATE_ALL_UPLOADS",
      description: "Permission to update uploads",
    },
  });
  const canUpdateOwnUploads = await prisma.permission.create({
    data: {
      name: "CAN_UPDATE_OWN_UPLOADS",
      description: "Permission to update own uploads",
    },
  });
  const canDeleteAllUploads = await prisma.permission.create({
    data: {
      name: "CAN_DELETE_ALL_UPLOADS",
      description: "Permission to delete uploads",
    },
  });
  const canDeleteOwnUploads = await prisma.permission.create({
    data: {
      name: "CAN_DELETE_OWN_UPLOADS",
      description: "Permission to delete own uploads",
    },
  });

  // --- SOURCES
  const booksSource = await prisma.source.create({
    data: { name: "books", description: "books source" },
  });
  const fruitsSource = await prisma.source.create({
    data: { name: "fruits", description: "fruits source" },
  });

  // --- GROUPS
  const group1 = await prisma.group.create({
    data: {
      name: "Books group",
      sources: { connect: { id: booksSource.id } },
    },
  });
  const group2 = await prisma.group.create({
    data: {
      name: "Fruits group",
      sources: { connect: { id: fruitsSource.id } },
    },
  });
  const group3 = await prisma.group.create({
    data: {
      name: "Group for all sources",
      sources: { connect: [{ id: booksSource.id }, { id: fruitsSource.id }] },
    },
  });

  // --- USERS
  const superAdmin = await prisma.user.create({
    data: {
      username: "superAdmin",
      role: "superAdmin",
      password: sha256("super@password"),
      permissions: {
        connect: [
          { id: canGetAllUploads.id },
          { id: canGetOwnUploads.id },
          { id: canCreateUpload.id },
          { id: canCreateUploadByForm.id },
          { id: canCreateUploadByFile.id },
          { id: canUpdateAllUploads.id },
          { id: canUpdateOwnUploads.id },
          { id: canDeleteAllUploads.id },
          { id: canDeleteOwnUploads.id },
        ],
      },
    },
  });
  consoleLog(`superAdmin id: ${superAdmin.id}`, "green");

  const admin1 = await prisma.user.create({
    data: {
      username: "admin1",
      role: "admin",
      password: sha256("admin1@password"),
      createdBy: superAdmin.id,
      permissions: {
        connect: [
          { id: canGetAllUploads.id },
          { id: canGetOwnUploads.id },
          { id: canCreateUploadByFile.id },
          { id: canUpdateAllUploads.id },
        ],
      },
    },
  });
  consoleLog(`admin 1 id: ${admin1.id}`, "green");

  const admin2 = await prisma.user.create({
    data: {
      username: "admin2",
      role: "admin",
      password: sha256("admin2@password"),
      createdBy: superAdmin.id,
      permissions: {
        connect: [
          { id: canGetOwnUploads.id },
          { id: canCreateUploadByForm.id },
          { id: canUpdateAllUploads.id },
          { id: canUpdateOwnUploads.id },
          { id: canDeleteOwnUploads.id },
        ],
      },
    },
  });
  consoleLog(`admin 2 id: ${admin2.id}`, "green");

  const admin3 = await prisma.user.create({
    data: {
      username: "admin3",
      role: "admin",
      password: sha256("admin3@password"),
      createdBy: superAdmin.id,
      permissions: {
        connect: [
          { id: canCreateUpload.id },
          { id: canUpdateAllUploads.id },
          { id: canDeleteAllUploads.id },
          { id: canDeleteOwnUploads.id },
        ],
      },
    },
  });
  consoleLog(`admin 3 id: ${admin3.id}`, "green");

  const user1 = await prisma.user.create({
    data: {
      username: "user1",
      role: "user",
      password: sha256("user1@password"),
      createdBy: admin1.id,
      groupId: group1.id,
    },
  });
  consoleLog(`user1 id: ${user1.id}`, "green");

  const user2 = await prisma.user.create({
    data: {
      username: "user2",
      role: "user",
      password: sha256("user2@password"),
      createdBy: admin1.id,
      groupId: group2.id,
    },
  });
  consoleLog(`user2 id: ${user2.id}`, "green");

  const user3 = await prisma.user.create({
    data: {
      username: "user3",
      role: "user",
      password: sha256("user3@password"),
      createdBy: admin2.id,
      groupId: group3.id,
    },
  });
  consoleLog(`user3 id: ${user3.id}`, "green");

  // --- UPLOADS
  const upload1 = await prisma.upload.create({
    data: {
      displayName: "21avril2023-file-1",
      date: new Date("2023-04-21T00:00:00.000Z"),
      type: "file",
      fileName: "upload1.zip",
      path: "uploads/21avril2023-file-1/upload1.zip",
      hash: sha256("upload1.zip"),
      userId: admin1.id,
    },
  });
  const upload2 = await prisma.upload.create({
    data: {
      displayName: "21avril2023-file-2",
      date: new Date("2023-04-21T00:00:00.000Z"),
      type: "file",
      fileName: "upload2.zip",
      path: "uploads/21avril2023-file-2/upload2.zip",
      hash: sha256("upload2.zip"),
      userId: admin2.id,
    },
  });
  const upload3 = await prisma.upload.create({
    data: {
      displayName: "21avril2023-file-3",
      date: new Date("2023-04-21T00:00:00.000Z"),
      type: "file",
      fileName: "upload3.zip",
      path: "uploads/21avril2023-file-3/upload3.zip",
      hash: sha256("upload3.zip"),
      userId: admin3.id,
    },
  });
}

main()
  .then(() => {
    consoleLog("\nSeed.js was executed successfully!", "green");
  })
  .catch((e) => console.error(e.message))
  .finally(async () => await prisma.$disconnect());
