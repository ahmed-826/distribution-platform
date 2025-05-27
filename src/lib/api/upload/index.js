import prisma from "@/lib/db";
import { HttpError } from "@/lib/api";

export const checkResourceAccess = (role, rolePermissions) => {
  if (!rolePermissions.authorizedRoles.includes(role)) {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }
};

export const searchParamsValidation = (searchParams) => {};

export const buildWhereClause = (
  searchParams,
  userId,
  role,
  rolePermissions
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

  if (rolePermissions.privilegedRoles.includes(role)) {
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

  return await prisma.upload.findMany(queryOptions);
};
