/**
 * P0-107: server authorization terpusat (model User->Roles->Permissions->Scope).
 * Aturan: deny default, union antar peran, scope + membership, RLS tetap berlaku.
 * TIDAK ADA pengecekan berbasis nama role di UI; selalu lewat permission.
 */

export type Scope =
  "GLOBAL" | "ORGANIZATION" | "DIVISION" | "CLASS" | "COURSE" | "OWN";

export type PermissionAssignment = {
  permission: string;
  scope: Scope;
};

export type Memberships = {
  userId: string;
  divisionIds: string[];
  classIds: string[];
};

export type ResourceContext = {
  ownerId?: string;
  divisionId?: string;
  classId?: string;
};

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";

export class AuthorizationError extends Error {
  readonly code: AuthErrorCode;
  readonly permission: string | undefined;

  constructor(code: AuthErrorCode, message: string, permission?: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.permission = permission;
  }
}

/**
 * Inti murni evaluasi akses. Dipakai require/can setelah data dimuat,
 * dan diuji langsung tanpa database.
 *
 * Catatan COURSE: penyempitan course-level menyusul Fase 3 (tabel courses).
 * Saat ini COURSE dievaluasi seperti CLASS — keanggotaan kelas adalah
 * unit terkecil yang bisa dibuktikan dari data.
 */
export function evaluateAccess(
  assignments: PermissionAssignment[],
  memberships: Memberships,
  permission: string,
  context: ResourceContext = {},
): boolean {
  for (const a of assignments) {
    if (a.permission !== permission) continue;
    switch (a.scope) {
      case "GLOBAL":
      case "ORGANIZATION":
        return true;
      case "DIVISION":
        if (
          context.divisionId &&
          memberships.divisionIds.includes(context.divisionId)
        ) {
          return true;
        }
        break;
      case "CLASS":
      case "COURSE":
        if (context.classId && memberships.classIds.includes(context.classId)) {
          return true;
        }
        break;
      case "OWN":
        if (context.ownerId && context.ownerId === memberships.userId) {
          return true;
        }
        break;
    }
  }
  return false;
}
