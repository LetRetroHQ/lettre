-- The library owns public objects independently of any draft. Never delete bytes when
-- a draft or its image association is removed: a URL may already have been shared.
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1))
) STRICT;
INSERT OR IGNORE INTO media_assets (id, filename, storage_key, content_type, width, height, created_at)
  SELECT id, filename, storage_key, content_type, width, height, created_at FROM images;
CREATE INDEX idx_media_assets_created ON media_assets (created_at DESC, id DESC);
CREATE TRIGGER images_catalog AFTER INSERT ON images BEGIN
  INSERT OR IGNORE INTO media_assets (id, filename, storage_key, content_type, width, height, created_at)
  VALUES (NEW.id, NEW.filename, NEW.storage_key, NEW.content_type, NEW.width, NEW.height, NEW.created_at);
END;
