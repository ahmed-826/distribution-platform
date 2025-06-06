import prisma from "@/lib/db";
import { HttpError, calculateFileHash } from "@/lib/api";
import fs from "fs/promises";
import * as pathLib from "path";
import { DateTime } from "luxon";
import JSZip from "jszip";

const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;

// --- GET ---
export const getResources = async (searchParams, userId, permissions) => {
  const where = {};

  const ids = searchParams.getAll("id");
  if (ids.length > 0) where.id = { in: ids };

  if (permissions.includes("CAN_GET_ALL_UPLOADS")) {
    const usernames = searchParams.getAll("username");
    if (usernames.length > 0) {
      where.user = { ["username"]: { in: usernames } };
    }
  } else if (permissions.includes("CAN_GET_OWN_UPLOADS")) {
    where.userId = userId;
  } else {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }

  const resources = await prisma.upload.findMany({
    where,
    orderBy: { date: "desc" },
    omit: { userId: true },
    include: {
      user: { select: { username: true, role: true } },
      fiches: true,
    },
  });

  return resources;
};

// --- POST ---
export const createResource = async (formData, userId, permissions) => {
  const byFileTypes = ["file", "api"];
  const byFormTypes = ["form"];

  const type = formDataValidation(formData, byFileTypes, byFormTypes);

  const byFile = byFileTypes.includes(type);
  const byForm = byFormTypes.includes(type);

  const canCreateUploadsByFile = [
    "CAN_CREATE_UPLOADS",
    "CAN_CREATE_UPLOAD_BY_FILE",
  ].some((p) => permissions.includes(p));
  const canCreateUploadsByForm = [
    "CAN_CREATE_UPLOADS",
    "CAN_CREATE_UPLOAD_BY_FORM",
  ].some((p) => permissions.includes(p));

  if (byFile && canCreateUploadsByFile) {
    return await createResourceByFile(formData, userId);
  } else if (byForm && canCreateUploadsByForm) {
    return await createResourceByForm(formData, userId);
  }
  throw new HttpError("Forbidden: insufficient permissions", 403);
};

const formDataValidation = (formData, byFileTypes, byFormTypes) => {
  const type = formData.get("type");
  const file = formData.get("file");
  const source = formData.get("source");
  const object = formData.get("object");
  const summary = formData.get("summary");
  const documents = formData.getAll("documents");

  const acceptableTypes = [...byFileTypes, ...byFormTypes];
  const acceptableFileTypes = [
    "application/zip",
    "application/x-zip-compressed",
  ];

  if (
    !acceptableTypes.includes(type) ||
    (byFileTypes.includes(type) &&
      (!file || !acceptableFileTypes.includes(file.type))) ||
    (byFormTypes.includes(type) &&
      (!source || !object || !summary || documents.length === 0))
  ) {
    throw new HttpError("Bad request", 400);
  }
  return type;
};

const createResourceByFile = async (formData, userId) => {
  const type = formData.get("type");
  const file = formData.get("file");

  const fileData = Buffer.from(await file.arrayBuffer());

  const hash = calculateFileHash(fileData);
  const resource = await prisma.upload.findUnique({ where: { hash } });
  if (resource) throw new HttpError("Resource already exists", 409);

  const fileName = file.name;

  const date = new Date();
  const formatDate = DateTime.fromJSDate(date).setLocale("fr");
  const formatDateForName = formatDate.toFormat("ddMMMMyyyy");
  const formatDateForPath = formatDate.toFormat("yyyyMMdd");

  const rank = await getRank(formatDateForName);

  const name = `${formatDateForName}-${type}-${rank}`;
  const path = pathLib.join(
    "data",
    "uploads",
    formatDateForPath,
    `${rank} - ${type} - ${fileName}`
  );

  const data = {
    name,
    date,
    type,
    fileName,
    path,
    hash,
    userId,
  };

  return await resourceTransaction(data, fileData);
};

const createResourceByForm = async (formData, userId) => {
  const type = formData.get("type");

  const source = formData.get("source");
  const object = formData.get("object");
  const summary = formData.get("summary");
  const documents = formData.getAll("documents");

  const date = new Date();
  const date_generate = DateTime.fromJSDate(date).toFormat(
    "yyyy/MM/dd HH:mm:ss"
  );
  let dump = formData.get("dump");
  const { dumpName, dumpDate } = dumpConstructor(dump, source, date);

  const jsonObject = {
    index: dumpName,
    summary,
    object,
    date_generate,
    source: { name: source, date_collect: dumpDate },
    files: documents.map((document) => ({
      type: document.name,
      original: {
        filename: document.name,
      },
    })),
  };
};

const getRank = async (startsWith) => {
  const previousRank = await prisma.upload.count({
    where: { name: { startsWith } },
  });
  return previousRank + 1;
};

const resourceTransaction = async (data, fileData) => {
  return await prisma.$transaction(async (prisma) => {
    const { id } = await prisma.upload.create({ data });

    const absolutePath = pathLib.join(FILE_STORAGE_PATH, data.path);
    const dirPath = pathLib.dirname(absolutePath);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(absolutePath, fileData);

    return id;
  });
};

const dumpConstructor = (dump, source, date) => {
  if (dump) {
    const [prefix, rest] = dump.split("_");
    if (prefix === "files" && rest) {
      const [sourceToValidate, suffix] = rest.split("-");
      if (sourceToValidate === source && suffix) {
        const datePart = DateTime.fromFormat(suffix.slice(0, 8), "yyyyMMdd");
        const digitPart = suffix.slice(8);
        if (datePart.isValid && /^\d+$/.test(digitPart)) {
          return { dumpName: dump, dumpDate: datePart.toFormat("yyyy/MM/dd") };
        }
      }
    }
  }

  const formattedDate = DateTime.fromJSDate(date).toFormat("yyyyMMdd");
  const dumpName = `files_${source}-${formattedDate}0000`;
  return { dumpName, dumpDate: null };
};

// --- PUT ---
export const updateResource = async (formData, userId, isPrivileged) => {
  const resourceId = formData.get("id");

  const where = { id: resourceId };
  if (!isPrivileged) where.userId = userId;

  const resource = await prisma.upload.findUnique({ where });
  if (!resource) throw new HttpError("Resource not found", 404);

  const action = formData.get("action");
  if (action === "process") return await processResource(resourceId, userId);
  else throw new HttpError("Bad request", 404);
};

const processResource = async (id, userId) => {
  try {
    await prisma.upload.update({
      where: { id },
      data: { status: "processing" },
    });

    const fileBuffer = await validateAndGetResource(resourceId);

    await processZipFile(fileBuffer, resourceId);

    await updateResourceRecord(resourceId, {
      status: "completed",
      userId,
    });
  } catch (error) {
    await prisma.upload.update({
      where: { id },
      data: { status: "failed" },
    });
    throw error;
  }
};

const updateResourceRecord = async (id, data) => {
  const resource = await prisma.upload.update({ where: { id }, data });
  return resource;
};

const validateAndGetResource = async (id) => {
  const resource = await prisma.upload.findUnique({ where: { id } });
  const absolutePath = pathLib.join(FILE_STORAGE_PATH, resource.path);
  const fileBuffer = await fs.readFile(absolutePath);
  return fileBuffer;
};

const processZipFile = async (fileBuffer, resourceId) => {
  const zipObject = await JSZip.loadAsync(fileBuffer);
  const paths = Object.keys(zipObject.files);

  const filePaths = paths.filter((path) => !zipObject.files[path].dir);
  const folders = [...new Set(filePaths.map(pathLib.dirname))];

  for (const folder of folders) {
    const pathsOfFolder = getFilePathsOfFolder(folder, filePaths);
    await processFolder(zipObject, pathsOfFolder, resourceId);
  }
};

const getFilePathsOfFolder = (folder, filePaths) => {
  const originalsFolder = pathLib.normalize(pathLib.join(folder, "Source"));

  const principalFilePaths = filePaths.filter(
    (path) =>
      pathLib.normalize(pathLib.dirname(path)) === pathLib.normalize(folder)
  );
  const originalFilePaths = filePaths.filter(
    (path) => pathLib.normalize(pathLib.dirname(path)) === originalsFolder
  );

  return { principalFilePaths, originalFilePaths };
};

const processFolder = async (zipObject, pathsOfFolder, resourceId) => {
  const { principalFilePaths: filePaths } = pathsOfFolder;
  // Process product
  await processProduct(zipObject, pathsOfFolder, resourceId).catch((error) => {
    console.error(error.message);
  });

  // Process nested zip files
  const zipFilePaths = filePaths.filter((path) => path.endsWith(".zip"));
  for (const zipFilePath of zipFilePaths) {
    const fileBuffer = await zipObject.file(zipFilePath).async("arraybuffer");
    await processZipFile(fileBuffer, resourceId).catch(() => {});
  }
};

const processProduct = async (zipObject, pathsOfFolder, resourceId) => {
  const {
    principalFilePaths: filePaths,
    originalFilePaths: originalDocumentsPaths,
  } = pathsOfFolder;

  const jsonPath = filePaths.find(isJson);
  const fichePath = filePaths.find(isFiche);
  const sourceDocumentsPaths = filePaths.filter(isDocument);

  if (
    !jsonPath ||
    !fichePath ||
    sourceDocumentsPaths.length === 0 ||
    originalDocumentsPaths.length === 0
  ) {
    return;
  }

  const jsonString = await zipObject.file(jsonPath).async("string");
  const ficheBuffer = await zipObject
    .file(fichePath)
    .async("arraybuffer")
    .then((buffer) => Buffer.from(buffer));

  const documentsBuffer = {};
  for (const sourceDocPath of sourceDocumentsPaths) {
    const index = parseInt(pathLib.basename(sourceDocPath));
    if (!isNaN(index)) {
      const sourceDocBuffer = await zipObject
        .file(sourceDocPath)
        .async("arraybuffer")
        .then((buffer) => Buffer.from(buffer));
      documentsBuffer[index - 1] = { ["sourceBuffer"]: sourceDocBuffer };
    }
  }

  for (const originalDocPaths of originalDocumentsPaths) {
    const index = parseInt(pathLib.basename(originalDocPaths));
    if (!isNaN(index)) {
      const originalDocBuffer = await zipObject
        .file(originalDocPaths)
        .async("arraybuffer")
        .then((buffer) => Buffer.from(buffer));

      if (originalDocPaths.endsWith(".eml")) {
        documentsBuffer[index - 1].messageBuffer = originalDocBuffer;
      } else {
        documentsBuffer[index - 1].originalBuffer = originalDocBuffer;
      }
    }
  }

  const { isValid, message } = await validateData(
    jsonString,
    ficheBuffer,
    documentsBuffer
  );

  if (!isValid) {
    console.error("Json file Not valid because: " + message);
    // add into failed fiche
  }

  const data = await buildData(
    jsonString,
    fichePath,
    ficheBuffer,
    documentsBuffer
  );

  await processTransaction(data, resourceId);
};

const isJson = (filePath) => {
  const jsonFileSuffix = "data.json";
  return filePath.endsWith(jsonFileSuffix);
};

const isFiche = (filePath) => {
  const ficheExtensions = [".docx"];
  return ficheExtensions.some((extension) => filePath.endsWith(extension));
};

const isDocument = (filePath) => {
  const documentExtensions = [".pdf", ".eml", ".xlsx"];
  return documentExtensions.some((extension) => filePath.endsWith(extension));
};

const validateData = async (jsonString, ficheBuffer, documentsBuffer) => {
  try {
    const jsonObject = JSON.parse(jsonString);

    const dump = jsonObject?.index;
    const sourceName = jsonObject?.source.name;
    const summary = jsonObject?.summary;
    const object = jsonObject?.object;
    const date = new Date(jsonObject?.date_generate);
    const files = jsonObject?.files?.map((file) => ({
      type: file?.type,
      fileName: file?.name?.filename,
      originalFileName: file?.original?.filename,
      content: file?.content,
      meta: file?.meta,
      path: file?.path,
      parent: file?.parent,
    }));

    if (!ficheBuffer) throw "Fiche erronée ou inaccessible";
    const hash = calculateFileHash(ficheBuffer);
    const fiche = await prisma.fiche.findUnique({ where: { hash } });
    if (fiche) throw "Fiche existe déjà";

    if (!dump) throw "Dump non spécifié dans (data.json)";
    if (!sourceName) throw "Source non spécifié dans (data.json)";
    if (!summary) throw "Synthèse  non spécifié dans (data.json)";
    if (!object) throw "Object  non spécifié dans (data.json)";
    if (!date) throw "Date de génération  non spécifié dans (data.json)";

    const source = await prisma.source.findUnique({
      where: { name: sourceName },
    });
    if (!source) throw "Source n'est pas valid";

    if (date.toString() === "Invalid Date")
      throw "Date de génération non spécifié ou n'est pas valide dans (data.json)";

    if (!files)
      throw "Les données sur les documents non spécifié dans (data.json)";

    if (files.length !== Object.keys(documentsBuffer).length)
      throw "Nombre de documents sources ne correspond pas aux données dans (data.json)";

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const { sourceBuffer, messageBuffer } = documentsBuffer[index];

      const { type, fileName, originalFileName, meta, parent } = file;
      if (!sourceBuffer) throw "L'un des documents est erroné ou inaccessible";
      if (!type)
        throw "Type de l'un des documents non spécifié dans (data.json)";
      if (!fileName)
        throw "Nom de l'un des documents non spécifié dans (data.json)";
      if (!originalFileName)
        throw "Nom d'origin de l'un des documents non spécifié dans (data.json)";
      if (type === "Message") {
        if (!meta)
          throw "Meta de l'un des documents (Message) non spécifié dans (data.json)";
        const { from, to, date: messageDate, object } = meta;
        if (!from || to.length === 0 || !messageDate || !object)
          throw "Meta de l'un des documents (Message) est incomplet dans (data.json)";
      }
      if (type === "Attachment") {
        if (!messageBuffer)
          throw "L'un des documents (Attachment) sans parent (Message)";
        if (!parent)
          throw "Parent de l'un des documents (Attachment) non spécifié dans (data.json)";
        const { from, to, date: messageDate, object } = parent;
        if (!from || to.length === 0 || !messageDate || !object)
          throw "Parent de l'un des documents (Attachment) est incomplet dans (data.json)";
      }
    }

    return { isValid: true, message: "Valid data" };
  } catch (error) {
    return { isValid: false, message: error };
  }
};

const buildData = async (
  jsonString,
  fichePath,
  ficheBuffer,
  documentsBuffer
) => {
  const jsonObject = JSON.parse(jsonString);
  const ficheData = {};
  const documentsData = [];
  const bufferPathMapping = {};

  const dump = jsonObject?.index;
  const sourceName = jsonObject?.source.name;
  const summary = jsonObject?.summary;
  const object = jsonObject?.object;
  const date = new Date(jsonObject?.date_generate);
  const files = jsonObject?.files?.map((file) => ({
    type: file?.type,
    fileName: file?.name?.filename,
    originalFileName: file?.original?.filename,
    content: file?.content,
    meta: file?.meta,
    path: file?.path,
    parent: file?.parent,
  }));

  const productPath = buildProductPath(sourceName, date, object);

  const source = await prisma.source.findUnique({
    where: { name: sourceName },
  });
  ficheData.sourceId = source.id;
  ficheData.date = date;
  ficheData.object = object;
  ficheData.summary = summary;
  ficheData.path = pathLib.join(productPath, pathLib.basename(fichePath));
  ficheData.hash = calculateFileHash(ficheBuffer);
  ficheData.dump = dump;

  bufferPathMapping[ficheData.path] = ficheBuffer;

  for (let index = 0; index < files.length; index++) {
    const documentData = {};
    const file = files[index];
    const { sourceBuffer, originalBuffer, messageBuffer } =
      documentsBuffer[index];

    const sourceData = {};

    sourceData.content = file.content;
    sourceData.meta = file.meta;
    sourceData.dumpInfo = { name: dump, path: file.path };
    sourceData.fileName = file.fileName;

    const type = file.type;
    sourceData.type = type;

    const path = pathLib.join(productPath, `${index + 1} - ${file.fileName}`);
    sourceData.path = path;

    const hash = calculateFileHash(sourceBuffer);
    sourceData.hash = hash;

    bufferPathMapping[path] = sourceBuffer;

    if (type !== "Message") {
      const originalHash = calculateFileHash(originalBuffer);
      if (hash !== originalHash) {
        const originalPath = pathLib.join(
          productPath,
          "originals",
          `${index + 1} - ${file.originalFileName}`
        );
        sourceData.originalPath = originalPath;
        bufferPathMapping[originalPath] = originalBuffer;
      }
    }
    documentData.sourceData = sourceData;
    if (type === "Attachment") {
      const messageData = {};
      const messageFileName = file.parent.filename;
      messageData.fileName = messageFileName;
      const messagePath = pathLib.join(
        productPath,
        "originals",
        `${index + 1} - ${messageFileName}`
      );
      messageData.path = messagePath;
      messageData.content = file.parent.content;
      messageData.type = "Message";
      messageData.dumpInfo = { name: dump, path: file.path };
      messageData.hash = calculateFileHash(messageBuffer);
      const { filename, content, ...messageMeta } = file.parent;
      messageData.meta = messageMeta;

      documentData.messageData = messageData;
      bufferPathMapping[messagePath] = messageBuffer;
    }

    documentsData.push(documentData);
  }

  const data = { ficheData, documentsData, bufferPathMapping };
  return data;
};

const processTransaction = async (data, resourceId) => {
  const { ficheData, documentsData, bufferPathMapping } = data;
  try {
    await prisma.$transaction(async (prisma) => {
      const ficheId = await createFiche(prisma, ficheData, resourceId);
      await createDocuments(prisma, documentsData, ficheId);
      await saveFiles(bufferPathMapping);
    });
    return { isPassed: true };
  } catch (error) {
    return { isPassed: false, message: error.message };
  }
};

const buildProductPath = (sourceName, date, object) => {
  const formatDateForPath = DateTime.fromJSDate(date).toFormat("yyyyMMdd");
  const productName = `${formatDateForPath} - ${object.slice(0, 20)}`;
  const productPath = pathLib.join(
    "data",
    "fiches",
    sourceName,
    formatDateForPath,
    productName
  );

  return productPath;
};

const createFiche = async (prisma, data, resourceId) => {
  const ref = "ABC-" + Math.floor(100 + Math.random() * 900);
  data.ref = ref;
  data.uploadId = resourceId;

  const fiche = await prisma.fiche.create({ data });

  const ficheId = fiche.id;
  return ficheId;
};

const createDocuments = async (prisma, data, ficheId) => {
  for (let index = 0; index < data.length; index++) {
    const documentData = data[index];
    const { sourceData, messageData } = documentData;
    sourceData.ficheId = ficheId;
    if (messageData) {
      const { id: messageId } = await prisma.document.create({
        data: messageData,
      });
      sourceData.messageId = messageId;
    }

    await prisma.document.create({ data: sourceData });
  }
};

const saveFiles = async (bufferPathMapping) => {
  for (const [path, buffer] of Object.entries(bufferPathMapping)) {
    const absolutePath = pathLib.join(FILE_STORAGE_PATH, path);
    const dirPath = pathLib.dirname(absolutePath);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }
};

// --- DELETE ---

export const deleteResources = async (
  resourceIds,
  userId,
  role,
  privilegedRoles
) => {
  const deletedResourceIds = [];

  for (const id of resourceIds) {
    const where = { id };
    if (!privilegedRoles.includes(role)) where.creatorId = userId;

    await prisma
      .$transaction(async (prisma) => {
        const paths = await prisma.upload.findUnique({
          where,
          select: { path: true, fiches: { select: { path: true } } },
        });
        await prisma.upload.delete({ where }).catch(() => {});

        const resourcePath = pathLib.join(FILE_STORAGE_PATH, paths.path);
        const ficheDirPaths = paths.fiches.map((fiche) =>
          pathLib.dirname(pathLib.join(FILE_STORAGE_PATH, fiche.path))
        );

        await fs.rm(resourcePath);
        await fs.rmdir(pathLib.dirname(resourcePath)).catch(() => {});

        for (const dirPath of ficheDirPaths) {
          await fs.rm(dirPath, { recursive: true });
          await fs.rmdir(pathLib.dirname(dirPath)).catch(() => {});
        }

        deletedResourceIds.push(id);
      })
      .catch(() => {});
  }

  return deletedResourceIds;
};
