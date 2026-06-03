-- Create new station_status enum
CREATE TYPE "public"."station_status" AS ENUM('active', 'inactive');
--> statement-breakpoint

-- Drop default before altering column type
ALTER TABLE "stations" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint

-- Convert column: map 'hidden' → 'inactive', keep 'active'
ALTER TABLE "stations"
  ALTER COLUMN "status" TYPE "public"."station_status"
  USING (
    CASE
      WHEN "status"::text = 'hidden' THEN 'inactive'::"public"."station_status"
      ELSE "status"::text::"public"."station_status"
    END
  );
--> statement-breakpoint

-- Restore default
ALTER TABLE "stations"
  ALTER COLUMN "status" SET DEFAULT 'active'::"public"."station_status";
