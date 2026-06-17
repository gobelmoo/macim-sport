CREATE TYPE "public"."queue_entry_status" AS ENUM('waiting', 'serving', 'done', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "queue_counters" (
	"counterId" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"counterName" text NOT NULL,
	"isOpen" boolean DEFAULT false NOT NULL,
	"sessionId" text NOT NULL,
	"lastDisplayNumber" integer DEFAULT 0 NOT NULL,
	"avgServiceSeconds" integer,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"entryId" text PRIMARY KEY NOT NULL,
	"counterId" text NOT NULL,
	"sessionId" text NOT NULL,
	"displayNumber" integer NOT NULL,
	"sortSeq" double precision NOT NULL,
	"entryStatus" "queue_entry_status" DEFAULT 'waiting' NOT NULL,
	"athleteId" text,
	"registrationId" text,
	"bibNumber" text,
	"lineUserId" text,
	"isNonMember" boolean DEFAULT false NOT NULL,
	"displayLabel" text,
	"statusToken" text NOT NULL,
	"enqueuedAt" timestamp DEFAULT now() NOT NULL,
	"calledAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queue_counters" ADD CONSTRAINT "queue_counters_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_counterId_queue_counters_counterId_fk" FOREIGN KEY ("counterId") REFERENCES "public"."queue_counters"("counterId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_registrationId_athlete_event_registrations_registrationId_fk" FOREIGN KEY ("registrationId") REFERENCES "public"."athlete_event_registrations"("registrationId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_entries_counter_status_idx" ON "queue_entries" USING btree ("counterId","entryStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_status_token_idx" ON "queue_entries" USING btree ("statusToken");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_active_athlete_idx" ON "queue_entries" USING btree ("counterId","athleteId") WHERE "queue_entries"."entryStatus" in ('waiting','serving','skipped') and "queue_entries"."athleteId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_active_bib_idx" ON "queue_entries" USING btree ("counterId","bibNumber") WHERE "queue_entries"."entryStatus" in ('waiting','serving','skipped') and "queue_entries"."bibNumber" is not null;