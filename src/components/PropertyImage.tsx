import { Home } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { tierForPrice } from "@/lib/game";
import { propertyImageUrl, type PropertyTier } from "@/lib/property-images";

export function PropertyImage({
  propertyId,
  listingPrice,
  address,
  locality,
  alt,
  className,
  loading = "lazy",
  imageUrl: _imageUrl,
}: {
  propertyId?: string | undefined | null;
  listingPrice: number | undefined | null;
  imageUrl?: string | null;
  address?: string | null;
  locality?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [errored, setErrored] = useState(false);
  const tier = listingPrice ? tierForPrice(Number(listingPrice)).id : null;
  const src = tier
    ? propertyImageUrl(tier as PropertyTier, propertyId ?? address ?? "", locality ?? "")
    : null;

  if (errored || !src) {
    return (
      <div
        className={cn(
          "relative w-full h-full bg-[#0f1219] flex items-center justify-center",
          className,
        )}
        aria-label={alt ?? "Property image unavailable"}
      >
        <Home className="w-10 h-10 text-amber-400" />
        {tier != null && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 tracking-wide">
            T{tier}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? "Property"}
      loading={loading}
      onError={() => setErrored(true)}
      className={cn("w-full h-full object-cover", className)}
    />
  );
}
