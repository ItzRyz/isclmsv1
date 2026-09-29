import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  student_number: string | null;
  avatar_path: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
};

export async function getOwnProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(`Gagal memuat profil: ${error.message}`);
  return data as Profile;
}
