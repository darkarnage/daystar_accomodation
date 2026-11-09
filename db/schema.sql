-- Daystar Student Accommodation Finder: MVP schema (MySQL 8, InnoDB)
-- Runs automatically on first container start (empty volume only).

CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,          -- bcrypt hash, never the password
  phone         VARCHAR(20)  NOT NULL,
  role          ENUM('student','admin') NOT NULL,   -- no landlord accounts: owners use the public submission form
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE listings (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title            VARCHAR(150) NOT NULL,
  description      TEXT NOT NULL,
  room_type        ENUM('single','bedsit','one_bedroom','shared','hostel') NOT NULL,
  rent_kes         INT UNSIGNED NOT NULL,
  location         VARCHAR(150) NOT NULL,
  distance_km      DECIMAL(3,1) NOT NULL,        -- distance to campus, entered by the submitter
  availability     ENUM('available','taken') NOT NULL DEFAULT 'available',
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  -- Contact details typed into the public submission form. Only logged-in students may see them.
  contact_name     VARCHAR(100) NOT NULL,
  contact_phone    VARCHAR(20)  NOT NULL,
  contact_email    VARCHAR(255) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listings_browse (status, availability, rent_kes),
  CONSTRAINT chk_listings_rent CHECK (rent_kes > 0)
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

-- Login sessions. The cookie holds a random token; only its SHA-256 hash is stored here,
-- so a leaked database cannot be used to log in. Logging out deletes the row.
CREATE TABLE sessions (
  token_hash CHAR(64) NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
