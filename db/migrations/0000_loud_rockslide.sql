CREATE TYPE "public"."status" AS ENUM('active', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('run', 'triathlon', 'other');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('physical_and_digital', 'digital_only');--> statement-breakpoint
CREATE TYPE "public"."stamp_source" AS ENUM('check_in', 'add_friend');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('air_recovery', 'ice_bath', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin_owner', 'super_admin_manager', 'super_admin_viewer', 'sponsor_admin', 'sponsor_staff');--> statement-breakpoint
CREATE TABLE "athlete_event_registrations" (
	"registrationId" text PRIMARY KEY NOT NULL,
	"athleteId" text,
	"eventId" text NOT NULL,
	"bibNumber" text NOT NULL,
	"profileImageUrl" text,
	"registeredAt" timestamp DEFAULT now() NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "athlete_event_registrations_bibNumber_eventId_unique" UNIQUE("bibNumber","eventId")
);
--> statement-breakpoint
CREATE TABLE "athletes" (
	"athleteId" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"dateOfBirth" date NOT NULL,
	"gender" "gender" NOT NULL,
	"lineUserId" text,
	"phoneNumber" text,
	"addressNo" text,
	"addressMoo" text,
	"addressSoi" text,
	"addressRoad" text,
	"addressSubdistrict" text,
	"addressDistrict" text,
	"addressProvince" text,
	"addressPostcode" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"checkinId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"stationId" text NOT NULL,
	"eventId" text NOT NULL,
	"bibNumber" text NOT NULL,
	"checkedInAt" timestamp DEFAULT now() NOT NULL,
	"isNewAthlete" boolean DEFAULT false NOT NULL,
	"isDuplicate" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"eventId" text PRIMARY KEY NOT NULL,
	"sponsorId" text NOT NULL,
	"eventName" text NOT NULL,
	"eventLocation" text NOT NULL,
	"eventCity" text NOT NULL,
	"eventType" "event_type" DEFAULT 'run' NOT NULL,
	"organizerName" text NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"hasParticipantImport" boolean DEFAULT false NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_bookings" (
	"bookingId" text PRIMARY KEY NOT NULL,
	"assetId" text NOT NULL,
	"eventId" text NOT NULL,
	"notes" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"assetId" text PRIMARY KEY NOT NULL,
	"assetName" text NOT NULL,
	"assetType" text NOT NULL,
	"serialNumber" text,
	"description" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_sponsors" (
	"athleteSponsorId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"sponsorId" text NOT NULL,
	"firstInteractionAt" timestamp DEFAULT now() NOT NULL,
	"totalStamps" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"auditId" text PRIMARY KEY NOT NULL,
	"userId" text,
	"action" text NOT NULL,
	"targetTable" text,
	"targetId" text,
	"before" jsonb,
	"after" jsonb,
	"ipAddress" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sponsors" (
	"eventSponsorId" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"sponsorId" text NOT NULL,
	"stampScope" text DEFAULT 'per_event' NOT NULL,
	"stampRule" text DEFAULT 'first_only' NOT NULL,
	"maxStampsPerAthlete" integer,
	"config" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"templateId" text PRIMARY KEY NOT NULL,
	"sponsorId" text,
	"triggerPoint" text NOT NULL,
	"channel" text DEFAULT 'line' NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb,
	"isActive" boolean DEFAULT false NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"logId" text PRIMARY KEY NOT NULL,
	"recipientId" text NOT NULL,
	"recipientType" text NOT NULL,
	"channel" text NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"metadata" jsonb,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"prefId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"receiveCheckinNotif" boolean DEFAULT true NOT NULL,
	"receiveStampNotif" boolean DEFAULT true NOT NULL,
	"receiveRewardNotif" boolean DEFAULT true NOT NULL,
	"receiveEventNotif" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_milestones" (
	"milestoneId" text PRIMARY KEY NOT NULL,
	"sponsorId" text NOT NULL,
	"stampCount" integer NOT NULL,
	"rewardTitle" text NOT NULL,
	"rewardDescription" text,
	"rewardType" text NOT NULL,
	"rewardDetail" jsonb,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"rewardId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"sponsorId" text NOT NULL,
	"eventId" text,
	"milestoneId" text,
	"rewardType" text NOT NULL,
	"rewardDetail" jsonb,
	"claimedAt" timestamp,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_blacklists" (
	"blacklistId" text PRIMARY KEY NOT NULL,
	"sponsorId" text NOT NULL,
	"athleteId" text NOT NULL,
	"reason" text,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_consent_templates" (
	"templateId" text PRIMARY KEY NOT NULL,
	"sponsorId" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"version" text NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_settings" (
	"settingId" text PRIMARY KEY NOT NULL,
	"sponsorId" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_event_assignments" (
	"assignmentId" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"eventId" text NOT NULL,
	"stationId" text,
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"tierId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"description" text,
	"maxEvents" integer,
	"maxStations" integer,
	"features" jsonb,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"sponsorId" text PRIMARY KEY NOT NULL,
	"sponsorName" text NOT NULL,
	"companyRegNumber" text NOT NULL,
	"addressNo" text,
	"addressMoo" text,
	"addressSoi" text,
	"addressRoad" text,
	"addressSubdistrict" text,
	"addressDistrict" text,
	"addressProvince" text,
	"addressPostcode" text,
	"isInternal" boolean DEFAULT false NOT NULL,
	"serviceType" "service_type" DEFAULT 'physical_and_digital' NOT NULL,
	"contactName" text NOT NULL,
	"contactEmail" text NOT NULL,
	"logoUrl" text,
	"brandColor" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stamps" (
	"stampId" text PRIMARY KEY NOT NULL,
	"athleteId" text NOT NULL,
	"eventId" text NOT NULL,
	"stationId" text,
	"sponsorId" text NOT NULL,
	"stampSource" "stamp_source" NOT NULL,
	"stampedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"stationId" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"stationType" "station_type" NOT NULL,
	"stationName" text NOT NULL,
	"stampOnAddFriend" boolean DEFAULT false NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"userId" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"phoneNumber" text,
	"role" "user_role" NOT NULL,
	"sponsorId" text,
	"lineUserId" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastLoginAt" timestamp,
	"ipAddress" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "athlete_event_registrations" ADD CONSTRAINT "athlete_event_registrations_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_event_registrations" ADD CONSTRAINT "athlete_event_registrations_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_stationId_stations_stationId_fk" FOREIGN KEY ("stationId") REFERENCES "public"."stations"("stationId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_bookings" ADD CONSTRAINT "asset_bookings_assetId_assets_assetId_fk" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("assetId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_bookings" ADD CONSTRAINT "asset_bookings_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_sponsors" ADD CONSTRAINT "athlete_sponsors_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_sponsors" ADD CONSTRAINT "athlete_sponsors_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sponsors" ADD CONSTRAINT "event_sponsors_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sponsors" ADD CONSTRAINT "event_sponsors_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_milestones" ADD CONSTRAINT "reward_milestones_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_blacklists" ADD CONSTRAINT "sponsor_blacklists_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_blacklists" ADD CONSTRAINT "sponsor_blacklists_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_blacklists" ADD CONSTRAINT "sponsor_blacklists_createdBy_users_userId_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("userId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_consent_templates" ADD CONSTRAINT "sponsor_consent_templates_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_settings" ADD CONSTRAINT "sponsor_settings_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_event_assignments" ADD CONSTRAINT "staff_event_assignments_userId_users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_event_assignments" ADD CONSTRAINT "staff_event_assignments_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_event_assignments" ADD CONSTRAINT "staff_event_assignments_stationId_stations_stationId_fk" FOREIGN KEY ("stationId") REFERENCES "public"."stations"("stationId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_athleteId_athletes_athleteId_fk" FOREIGN KEY ("athleteId") REFERENCES "public"."athletes"("athleteId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_stationId_stations_stationId_fk" FOREIGN KEY ("stationId") REFERENCES "public"."stations"("stationId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_eventId_events_eventId_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sponsorId_sponsors_sponsorId_fk" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("sponsorId") ON DELETE set null ON UPDATE no action;