-- 1日ごとの利用回数。key は端末ID・IP を HMAC でハッシュにしたもの（元の値は持たない）。
-- scope: device / ip / global（将来ログインを足したら user を足す）
CREATE TABLE IF NOT EXISTS usage (
  day   TEXT    NOT NULL, -- 日本時間の YYYY-MM-DD
  scope TEXT    NOT NULL,
  key   TEXT    NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, scope, key)
);
