-- Post image rows claim names before object storage completes. Keep their catalog entries
-- hidden until the object write succeeds, including if a Worker stops mid-upload.
ALTER TABLE media_assets ADD COLUMN ready INTEGER NOT NULL DEFAULT 1 CHECK (ready IN (0, 1));
DROP TRIGGER images_catalog;
CREATE TRIGGER images_catalog AFTER INSERT ON images BEGIN
  INSERT OR IGNORE INTO media_assets (id, filename, storage_key, content_type, width, height, created_at, ready)
  VALUES (NEW.id, NEW.filename, NEW.storage_key, NEW.content_type, NEW.width, NEW.height, NEW.created_at, 0);
END;
