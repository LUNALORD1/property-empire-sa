import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { City, PlayerProperty, Property } from "@/lib/game";

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
