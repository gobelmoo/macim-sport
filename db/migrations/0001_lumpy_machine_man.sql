CREATE INDEX "aer_event_id_idx" ON "athlete_event_registrations" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "checkins_athlete_event_idx" ON "checkins" USING btree ("athleteId","eventId");--> statement-breakpoint
CREATE INDEX "checkins_event_id_idx" ON "checkins" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "checkins_checked_in_at_idx" ON "checkins" USING btree ("checkedInAt");--> statement-breakpoint
CREATE INDEX "events_sponsor_id_idx" ON "events" USING btree ("sponsorId");--> statement-breakpoint
CREATE INDEX "stamps_sponsor_id_idx" ON "stamps" USING btree ("sponsorId");--> statement-breakpoint
CREATE INDEX "stamps_event_id_idx" ON "stamps" USING btree ("eventId");