import prisma from "@/lib/db";
import { HttpError } from "@/lib/api";

const acceptableRoles = ["admin", "superAdmin"];
const privilegedRole = "superAdmin";

export const checkResourceAccess = (role) => {
  if (!acceptableRoles.includes(role)) {
    throw new HttpError("Forbidden: insufficient permissions", 403);
  }
};

export const buildWhereClause = (searchParams, role) => {
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

  if (role === privilegedRole) {
    const usernames = searchParams.getAll("username");
    where.user.username = { in: usernames };
  }

  return where;
};

export const buildIncludeClause = (searchParams) => {
  // Built includeClause from searchParams
  // Acceptable params: include
  const include = {};

  const fields = searchParams.getAll("include");
  fields.forEach((field) => {
    include[field] = true;
  });

  return include;
};

export const buildSelectClause = (searchParams) => {
  // Built selectClause from searchParams
  // Acceptable params: select (param OR user.param)
  const select = {};

  const fields = searchParams.getAll("select");
  fields.forEach((field) => {
    select[field] = true;
  });

  return select;
};

export const buildOrderByClause = (searchParams) => {
  // Built orderBy from searchParams
  // Acceptable params: orderBy
  const orderBy = [];

  const byFields = searchParams.getAll("orderBy");
  byFields.forEach((byFields) => {
    const [field, order] = byFields.split(".");
    const orderInstance = {};
    orderInstance[field] = order;
    orderBy.push(orderInstance);
  });

  return orderBy;
};

export const getResources = async (where, include, select, orderBy) => {
  const omit = { userId: true };

  const queryOptions = {
    where,
    orderBy,
    ...(Object.keys(select).length > 0 ? { select } : { include, omit }),
  };

  return await prisma.upload.findMany(queryOptions);
};
