import prisma from "@/lib/db";
import { HttpError, calculateFileHash } from "@/lib/api";
import fs from "fs/promises";
import * as pathLib from "path";
import { DateTime } from "luxon";

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

export const ensureResourceExists = async (resourceId) => {
  const resource = await prisma.upload.findUnique({
    where: { id: resourceId },
  });
  if (!resource) {
    throw new HttpError("Resource not found", 404);
  }

  const { creatorId } = resource;
  return creatorId;
};

export const verifyUpdatePermission = (
  userId,
  creatorId,
  role,
  privilegedRoles
) => {
  if (userId !== creatorId && !privilegedRoles.includes(role)) {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }
};
