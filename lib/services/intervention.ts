import { getSupabaseBrowserClient } from "@/lib/supabase/client"

// ---------- Types ----------

export type Intervention = {
  id: string
  reason: string
  message: string
  status: "pending" | "shown" | "interacted" | "dismissed"
  created_at: string
}

// ---------- Functions ----------

export async function getLatestPendingIntervention(): Promise<Intervention | null> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("interventions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0] as Intervention
}

export async function markInterventionAsShown(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from("interventions")
    .update({ status: "shown" })
    .eq("id", id)

  if (error) throw error
}
