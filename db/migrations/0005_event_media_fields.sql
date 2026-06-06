CREATE TYPE "public"."line_state" AS ENUM('idle', 'awaiting_event', 'awaiting_bib', 'awaiting_confirm', 'awaiting_consent', 'done');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'inactive';--> statement-breakpoint
CREATE TABLE "event_gallery_images" (
	"imageId" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"imageUrl" text NOT NULL,
	"caption" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_consents" (
	"consentId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"consentVersion" text NOT NULL,
	"pdpaAccepted" boolean NOT NULL,
	"marketingAccepted" boolean DEFAULT false NOT NULL,
	"consentedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_sessions" (
	"lineUserId" text PRIMARY KEY NOT NULL,
	"state" "line_state" DEFAULT 'idle' NOT NULL,
	"eventId" text,
	"bibNumber" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" SET DATA TYPE "public"."station_status" USING "status"::text::"public"."station_status";--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "eventLogoUrl" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "longDescription" text;--> statement-breakpoint
ALTER TABLE "event_gallery_images" ADD CONSTRAINT "event_gallery_images_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_consents" ADD CONSTRAINT "athlete_consents_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_sessions" ADD CONSTRAINT "line_sessions_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_images_event_id_idx" ON "event_gallery_images" USING btree ("eventId");