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
