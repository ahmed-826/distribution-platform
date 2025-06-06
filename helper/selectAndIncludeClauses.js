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

const buildWhereClause = (searchParams, userId, role, privilegedRoles) => {
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
