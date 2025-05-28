import { NextResponse } from "next/server";
import { HttpError, getUserId, getUserRole } from "@/lib/api";
import {
  authorizeRole,
  buildWhereClause,
  buildIncludeClause,
  buildSelectClause,
  buildOrderByClause,
  getResources,
  createResource,
} from "@/lib/api/upload";

const authorizedRoles = ["admin", "superAdmin"];
const privilegedRoles = ["superAdmin"];

export const GET = async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get userId
    const userId = getUserId();
    const role = await getUserRole(userId);

    // Check resource access (throw Forbidden (403) error if failed)
    authorizeRole(role, authorizedRoles);

    // Build whereClause
    const where = buildWhereClause(searchParams, userId, role, privilegedRoles);

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
        error: { message: "Internal server error" },
      },
      { status: 500 }
    );
  }
};

export const POST = async (request) => {
  try {
    // Get userId
    const userId = getUserId();
    const role = await getUserRole(userId);

    // Check resource access (throw Forbidden (403) error if failed)
    authorizeRole(role, authorizedRoles);

    const formData = await request.formData();
    await createResource(formData, userId);

    return NextResponse.json({
      data: "Resource was created successfully",
      error: null,
    });
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
        error: { message: "Internal server error" },
      },
      { status: 500 }
    );
  }
};
