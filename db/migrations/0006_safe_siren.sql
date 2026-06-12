CREATE TABLE "line_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"fallbackEnabled" boolean DEFAULT true NOT NULL,
	"fallbackMessage" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);