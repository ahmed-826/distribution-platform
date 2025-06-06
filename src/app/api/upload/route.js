import { NextResponse } from "next/server";
import { formatErrorResponse, getUser } from "@/lib/api";
import {
  getResources,
  createResource,
  updateResource,
  deleteResources,
} from "@/lib/api/upload";

const authorizedRoles = ["superAdmin", "admin"];
const privilegedRoles = ["superAdmin"];

export const GET = async (request) => {
  try {
    const { userId, permissions } = await getUser();

    const { searchParams } = new URL(request.url);

    const resources = await getResources(searchParams, userId, permissions);

    return NextResponse.json({ data: resources, error: null });
  } catch (error) {
    return formatErrorResponse(error);
  }
};

export const POST = async (request) => {
  try {
    const { userId, permissions } = await getUser();

    const formData = await request.formData();

    const resourceId = await createResource(formData, userId, permissions);

    return NextResponse.json({ data: resourceId, error: null });
  } catch (error) {
    return formatErrorResponse(error);
  }
};

export const PUT = async (request) => {
  try {
    const { userId, role, permissions } = await getUser();

    const isAuthorized = authorizedRoles.includes(role);
    const isPrivileged = privilegedRoles.includes(role);

    if (!isAuthorized) {
      throw new HttpError("Forbidden: insufficient permissions", 403);
    }

    const formData = await request.formData();
    const resourceId = await updateResource(formData, userId, isPrivileged);

    return NextResponse.json({
      data: resourceId,
      error: null,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
};

export const DELETE = async (request) => {
  try {
    const { id: userId, role } = await getUser();

    const isAuthorized = authorizedRoles.includes(role);
    const isPrivileged = privilegedRoles.includes(role);

    if (!isAuthorized) {
      throw new HttpError("Forbidden: insufficient permissions", 403);
    }

    const { searchParams } = new URL(request.url);

    const ids = await deleteResources(searchParams, userId, isPrivileged);

    return NextResponse.json({ data: ids, error: null });
  } catch (error) {
    formatErrorResponse(error);
  }
};
