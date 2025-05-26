import { NextResponse } from "next/server";
import { HttpError, getUserId, getUserRole } from "@/lib/api";
import {
  checkResourceAccess,
  buildWhereClause,
  buildIncludeClause,
  buildSelectClause,
  buildOrderByClause,
  getResources,
} from "@/lib/api/upload";

export const GET = async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get userId
    const userId = getUserId();
    const role = await getUserRole(userId);
    // Check resource access (throw error if failed)
    checkResourceAccess(role);

    // Build whereClause
    const where = buildWhereClause(searchParams, role);

    // Build includeClause
    const include = buildIncludeClause(searchParams);

    // Build selectClause
    const select = buildSelectClause(searchParams);

    // Build orderByClause
    const orderby = buildOrderByClause(searchParams);

    // get resources
    const resources = await getResources(where, include, select, orderby);
    return NextResponse.json({ data: resources, error: null });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { data: null, error: { message: error.getMessage() } },
        { status: error.getStatus() }
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: { message: "Internal server error\n" + error.message },
      },
      { status: 500 }
    );
  }
};
