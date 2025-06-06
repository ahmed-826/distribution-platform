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
export const getResources = async (
  searchParams,
  userId,
  role,
  privilegedRoles
) => {
  const where = buildWhereClause(searchParams, userId, role, privilegedRoles);
  const include = buildIncludeClause(searchParams);
  const select = buildSelectClause(searchParams);
  const orderBy = buildOrderByClause(searchParams);

  const queryOptions = {
    where,
    orderBy,
    ...(Object.keys(select).length > 0 ? { select } : { include }),
  };

  const resources = await prisma.upload.findMany(queryOptions);
  const filteredResources = filterResources(resources);

  return filteredResources;
};

const buildWhereClause = (searchParams, userId, role, privilegedRoles) => {
  // Built whereClause from searchParams
  // Acceptable params: id,  name, type, status, date, startDate, endDate, username
  const where = {};

  const ids = searchParams.getAll("id");
  const refs = searchParams.getAll("ref");
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

const buildIncludeClause = (searchParams) => {
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

const buildSelectClause = (searchParams) => {
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

const buildOrderByClause = (searchParams) => {
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
