CREATE TABLE IF NOT EXISTS migrations (
    level INTEGER,
    comment TEXT,
    "timestamp" INTEGER,
    checksum TEXT,
    namespace TEXT DEFAULT 'default',
    PRIMARY KEY (level, namespace)
);

CREATE TABLE IF NOT EXISTS migrations_lock (dummy_column INT NOT NULL DEFAULT 1);
