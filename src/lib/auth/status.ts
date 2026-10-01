/**
 * Gerbang status akun: hanya profil ACTIVE yang boleh diizinkan akses.
 * Dipakai can()/requirePermission() — deny default untuk status aneh/null.
 */
export function isProfileActive(status: string | null | undefined): boolean {
  return status === "ACTIVE";
}
