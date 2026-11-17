-- Migration 001: adds the contact_messages table (public contact form) to an EXISTING CampusNest database.
--
-- Safe to run on a database that already holds data: it only creates one new table, and only if it does not exist yet.
-- It never drops, empties or changes any existing table or row, and running it twice does nothing the second time.
-- New databases do not need it: db/schema.sql already contains this table.
--
-- Run it against the database you use (daystar_accommodation, and your separate _test database for the tests):
-- phpMyAdmin: select the database, open Import, choose this file. Or: USE daystar_accommodation; SOURCE db/migrations/001-contact-messages.sql;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
