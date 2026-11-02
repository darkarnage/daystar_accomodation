-- Daystar Student Accommodation Finder: MVP schema (MySQL 8, InnoDB)
-- Runs automatically on first container start (empty volume only).

CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,          -- bcrypt hash, never the password
  phone         VARCHAR(20)  NOT NULL,
  role          ENUM('student','landlord','admin') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE listings (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  landlord_id      INT UNSIGNED NOT NULL,
  title            VARCHAR(150) NOT NULL,
  description      TEXT NOT NULL,
  room_type        ENUM('single','bedsit','one_bedroom','shared','hostel') NOT NULL,
  rent_kes         INT UNSIGNED NOT NULL,
  location         VARCHAR(150) NOT NULL,
  distance_km      DECIMAL(3,1) NOT NULL,        -- distance to campus, entered by landlord
  availability     ENUM('available','taken') NOT NULL DEFAULT 'available',
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listings_browse (status, availability, rent_kes),
  KEY idx_listings_landlord (landlord_id),
  CONSTRAINT chk_listings_rent CHECK (rent_kes > 0),
  -- Deleting a landlord deletes their listings (and, via the tables below, everything attached)
  CONSTRAINT fk_listings_landlord FOREIGN KEY (landlord_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE listing_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id INT UNSIGNED NOT NULL,
  file_path  VARCHAR(255) NOT NULL,              -- e.g. uploads/ab12cd.jpg
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_images_listing (listing_id),
  CONSTRAINT fk_images_listing FOREIGN KEY (listing_id)
    REFERENCES listings (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE amenities (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_amenities_name (name)
) ENGINE=InnoDB;

CREATE TABLE listing_amenities (
  listing_id INT UNSIGNED NOT NULL,
  amenity_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (listing_id, amenity_id),
  CONSTRAINT fk_la_listing FOREIGN KEY (listing_id)
    REFERENCES listings (id) ON DELETE CASCADE,
  CONSTRAINT fk_la_amenity FOREIGN KEY (amenity_id)
    REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favourites (
  user_id    INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_listing FOREIGN KEY (listing_id)
    REFERENCES listings (id) ON DELETE CASCADE
) ENGINE=InnoDB;
