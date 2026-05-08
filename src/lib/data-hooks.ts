import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Assistant, City, Loan, LuckEvent, PlayerProperty, Property } from "@/lib/game";

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("*").order("name");
      if (error) throw error;
      return data as City[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useMarketProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("status", "active").order("listing_price");
      if (error) throw error;
      return data as Property[];
    },
    staleTime: 1000 * 60,
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function usePlayerProperties(userId: string | undefined) {
  return useQuery({
    queryKey: ["player_properties", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_properties")
        .select("*, property:property_id(*, city:city_id(*))")
        .eq("player_id", userId!)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as PlayerProperty[];
    },
  });
}

export function useLedger(userId: string | undefined) {
  return useQuery({
    queryKey: ["ledger", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger").select("*").eq("player_id", userId!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useLoans(userId: string | undefined) {
  return useQuery({
    queryKey: ["loans", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("*").eq("player_id", userId!).order("started_at", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
  });
}

export function useAssistants(userId: string | undefined) {
  return useQuery({
    queryKey: ["assistants", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("assistants").select("*").eq("player_id", userId!).order("hired_at", { ascending: false });
      if (error) throw error;
      return data as Assistant[];
    },
  });
}

export function useLuckEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["luck_events", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("luck_events")
        .select("*")
        .eq("player_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as LuckEvent[];
    },
    refetchInterval: 30_000,
  });
}

export function useAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ["achievements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("player_id", userId!)
        .order("unlocked_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data: latest } = await supabase
        .from("leaderboard_snapshots")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      const date = latest?.[0]?.snapshot_date;
      if (!date) return { date: null as string | null, rows: [] as any[] };
      const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select("*")
        .eq("snapshot_date", date)
        .order("rank", { ascending: true });
      if (error) throw error;
      return { date, rows: data ?? [] };
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useTenants(userId: string | undefined) {
  return useQuery({
    queryKey: ["tenants", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenants")
        .select("*, renter_type:renter_type_key(*)")
        .eq("player_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApplicantsCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["applicants_count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_applicants")
        .select("player_property_id")
        .eq("player_id", userId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        map[r.player_property_id] = (map[r.player_property_id] ?? 0) + 1;
      }
      return map;
    },
  });
}

export function useMarketNews() {
  return useQuery({
    queryKey: ["market_news"],
    queryFn: async () => {
      // Last 2 days of news so the ticker is never empty
      const since = new Date();
      since.setDate(since.getDate() - 1);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("market_news")
        .select("*")
        .gte("tick_date", sinceStr)
        .order("tick_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60,
    refetchInterval: 60_000,
  });
}

export function useValueHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["value_history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("property_value_history")
        .select("player_property_id, recorded_date, value")
        .eq("player_id", userId!)
        .order("recorded_date", { ascending: true });
      if (error) throw error;
      const map: Record<string, Array<{ date: string; value: number }>> = {};
      for (const r of (data ?? []) as any[]) {
        (map[r.player_property_id] ||= []).push({ date: r.recorded_date, value: Number(r.value) });
      }
      return map;
    },
    staleTime: 1000 * 30,
  });
}
