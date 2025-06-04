import prisma from "@/lib/db";
import { HttpError, calculateFileHash } from "@/lib/api";
import fs from "fs/promises";
import * as pathLib from "path";
import { DateTime } from "luxon";
import { fileTypeFromBuffer } from "file-type";
import JSZip from "jszip";

const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;

export const authorizeRole = (role, authorizedRoles) => {
  if (!authorizedRoles.includes(role)) {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }
};

// --- GET ---
export const buildWhereClause = (
  searchParams,
  userId,
  role,
  privilegedRoles
) => {
  // Built whereClause from searchParams
  // Acceptable params: id,  name, type, status, date, startDate, endDate, username
  const where = {};

  const ids = searchParams.getAll("id");
  const names = searchParams.getAll("name");
  const types = searchParams.getAll("type");
  const statutes = searchParams.getAll("status");
  const dates = searchParams.getAll("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (ids.length > 0) where.id = { in: ids };
  if (names.length > 0) where.name = { in: names };
  if (types.length > 0) where.type = { in: types };
  if (statutes.length > 0) where.status = { in: statutes };

  where.date = {};
  if (dates.length > 0) where.date.in = dates.map((date) => new Date(date));
  if (startDate) where.date.gte = new Date(startDate);
  if (endDate) where.date.lte = new Date(endDate);

  if (privilegedRoles.includes(role)) {
    const usernames = searchParams.getAll("username");
    if (usernames.length > 0) {
      where.user = {};
      where.user.username = { in: usernames };
    }
  } else {
    where.userId = userId;
  }

  return where;
};

export const buildIncludeClause = (searchParams) => {
  // Built includeClause from searchParams
  // Acceptable params: include
  const include = {};

  const entries = searchParams.getAll("include");
  entries.forEach((entry) => {
    const parts = entry.split(".");

    let current = include;

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? true : { select: {} };
      }
      if (index < parts.length - 1) {
        if (current[part] === true) {
          current[part] = { select: {} };
        }
        current = current[part].select;
      }
    });
  });

  return include;
};

export const buildSelectClause = (searchParams) => {
  // Built selectClause from searchParams
  // Acceptable params: select
  const select = {};

  const entries = searchParams.getAll("select");
  entries.forEach((entry) => {
    const parts = entry.split(".");

    let current = select;

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? true : { select: {} };
      }
      if (index < parts.length - 1) {
        if (current[part] === true) {
          current[part] = { select: {} };
        }
        current = current[part].select;
      }
    });
  });

  return select;
};

export const buildOrderByClause = (searchParams) => {
  // Built orderBy from searchParams
  // Acceptable params: orderBy
  const orderBy = [];

  const byFields = searchParams.getAll("orderBy");
  byFields.forEach((entry) => {
    const [field, order] = entry.split(".");
    orderBy.push({ [field]: order });
  });

  return orderBy;
};

export const getResources = async (where, include, select, orderBy) => {
  const queryOptions = {
    where,
    orderBy,
    ...(Object.keys(select).length > 0 ? { select } : { include }),
  };

  const resources = await prisma.upload.findMany(queryOptions);
  const filteredResources = filterResources(resources);

  return filteredResources;
};

const filterResources = (resources) => {
  const filter = {
    id: true,
    name: true,
    date: true,
    type: true,
    status: true,
    fileName: true,
    path: true,
    hash: true,
    creator: { username: true, role: true },
    processor: { username: true, role: true },
  };

  const filterFieldsRecursively = (obj, filterMap) => {
    if (typeof obj !== "object" || obj === null || !filterMap) return undefined;

    const result = Array.isArray(obj) ? [] : {};

    for (const key in filterMap) {
      if (filterMap[key] === true) {
        result[key] = obj[key];
      } else if (
        typeof filterMap[key] === "object" &&
        typeof obj[key] === "object"
      ) {
        const nested = filterFieldsRecursively(obj[key], filterMap[key]);
        if (nested !== undefined) {
          result[key] = nested;
        }
      }
    }

    return result;
  };

  const filteredResources = resources.map((resource) =>
    filterFieldsRecursively(resource, filter)
  );
  return filteredResources;
};

// --- POST ---
export const createResource = async (formData, userId) => {
  const type = formDataValidation(formData);
  if (type === "form") await createResourceByForm(formData, userId);
  else await createResourceByFile(formData, userId);
};

const formDataValidation = (formData) => {
  const type = formData.get("type");
  const file = formData.get("file");
  const source = formData.get("source");
  const object = formData.get("object");
  const summary = formData.get("summary");
  const documents = formData.getAll("documents");

  const typeOptions = ["file", "api", "form"];
  const byFileTypes = ["file", "api"];
  const byFormTypes = ["form"];

  const acceptableFileTypes = [
    "application/zip",
    "application/x-zip-compressed",
  ];

  if (
    !typeOptions.includes(type) ||
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
  await prisma.upload.findUnique({ where: { hash } }).then((resource) => {
    if (resource) throw new HttpError("Resource already exists", 409);
  });

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
    creatorId: userId,
  };

  await resourceTransaction(data, fileData);
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
  await prisma.$transaction(async (prisma) => {
    await prisma.upload.create({ data });

    const absolutePath = pathLib.join(FILE_STORAGE_PATH, data.path);
    const dirPath = pathLib.dirname(absolutePath);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(absolutePath, fileData);
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
export const updateResource = async (
  formData,
  userId,
  role,
  privilegedRoles
) => {
  const resourceId = formData.get("id");

  // Ensures the resource exists; throws a 404 not found error on failure
  const creatorId = await ensureResourceExists(resourceId);

  // Check if the user has permission to update this resource; throw a 403 Forbidden error on failure
  if (userId !== creatorId && !privilegedRoles.includes(role)) {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }

  const action = formData.get("action");
  if (action === "process") await processResource(resourceId, userId);
  else throw new HttpError("Bad request", 404);
};

const ensureResourceExists = async (id) => {
  const { creatorId } = await prisma.upload
    .findUnique({ where: { id } })
    .then((resource) => {
      if (!resource) {
        throw new HttpError("Resource not found", 404);
      }
      return resource;
    });
  return creatorId;
};

const processResource = async (resourceId, processorId) => {
  try {
    await updateResourceFields(resourceId, { status: "processing" });

    const fileBuffer = await validateAndGetResource(resourceId);

    await processZipFile(fileBuffer, resourceId);

    await updateResourceFields(resourceId, {
      status: "completed",
      processorId,
    });
  } catch (error) {
    await updateResourceFields(resourceId, { status: "failed" });
    throw error;
  }
};

const updateResourceFields = async (id, data) => {
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
  await processProduct(zipObject, pathsOfFolder, resourceId); //.catch(() => {});

  // Process nested zip files
  const zipFilePaths = filePaths.filter((path) => path.endsWith(".zip"));
  for (const zipFilePath of zipFilePaths) {
    const fileBuffer = await zipObject.file(zipFilePath).async("arraybuffer");
    await processZipFile(fileBuffer, resourceId); //.catch(() => {});
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
