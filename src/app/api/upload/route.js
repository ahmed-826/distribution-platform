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
  ensureResourceExists,
  verifyUpdatePermission,
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

export async function PUT(request) {
  try {
    // Get userId
    const userId = getUserId();
    const role = await getUserRole(userId);

    // Validate user role against allowed roles; throw a 403 Forbidden error on failure
    authorizeRole(role, authorizedRoles);

    const formData = await request.formData();
    const resourceId = formData.get("id");

    // Ensures the resource exists; throws a 404 not found error on failure
    const creatorId = await ensureResourceExists(resourceId);

    // Check if the user has permission to update this resource; throw a 403 Forbidden error on failure
    verifyUpdatePermission(userId, creatorId, role, privilegedRoles);

    return NextResponse.json({
      data: "Resource was updated successfully",
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
}
