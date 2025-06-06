import { NextResponse } from "next/server";
import { formatErrorResponse, getUserId, getUserRole } from "@/lib/api";
import {
  authorizeRole,
  getResources,
  // createResource,updateResource, deleteResources,
} from "@/lib/api/fiche";

const authorizedRoles = ["superAdmin", "admin", "user"];
const privilegedRoles = ["superAdmin"];

export const GET = async (request) => {
  try {
    // Get userId and role and role
    const userId = getUserId();
    const role = await getUserRole(userId);

    // Validate user role against authorized roles; throw a 403 Forbidden error on failure
    authorizeRole(role, authorizedRoles);

    const { searchParams } = new URL(request.url);
    const resources = await getResources(
      searchParams,
      userId,
      role,
      privilegedRoles
    );

    return NextResponse.json({ data: resources, error: null });
  } catch (error) {
    formatErrorResponse(error);
  }
};
