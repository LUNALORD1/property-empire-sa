import { Home } from "lucide-react";
import { useState } from "react";
import { getPropertyImageUrl } from "@/lib/property-image";
import { cn } from "@/lib/utils";

export function PropertyImage({
  propertyId,
  listingPrice,
  imageUrl,
  alt,
  className,
  loading = "lazy",
}: {
  propertyId: string | undefined | null;
  listingPrice: number | undefined | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [errored, setErrored] = useState(false);
  // Prefer DB-stored image_url (unique per property), fall back to deterministic
  // generator for any legacy rows without an image_url set.
  const src = imageUrl ?? getPropertyImageUrl(propertyId, listingPrice);

  if (errored) {
    return (
      <div
        className={cn(
          "w-full h-full bg-muted flex items-center justify-center text-muted-foreground",
          className,
        )}
        aria-label={alt ?? "Property image unavailable"}
      >
        <Home className="w-8 h-8 opacity-60" />
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
