import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


class UserManager:

    @contextmanager
    def get_cursor(self):
        conn = psycopg2.connect(
            DATABASE_URL,
            sslmode="require",
            connect_timeout=5
        )
        conn.autocommit = True
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
        finally:
            conn.close()

    def sync_oauth_user(self, provider, provider_id, display_name, username, email, avatar):
        if provider == "google":
            id_col = "google_id"
            email_col = "google_email"
            avatar_col = "google_avatar"
            user_col = "display_name"
        else:
            id_col = "discord_id"
            email_col = "discord_email"
            avatar_col = "discord_avatar"
            user_col = "discord_username"

        sql = f"""
            INSERT INTO users (
                {id_col}, original_provider, display_name,
                {user_col}, {email_col}, {avatar_col}
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT ({id_col})
            DO UPDATE SET
                last_login = CURRENT_TIMESTAMP,
                display_name = EXCLUDED.display_name,
                {user_col} = EXCLUDED.{user_col},
                {email_col} = EXCLUDED.{email_col},
                {avatar_col} = EXCLUDED.{avatar_col}
            RETURNING *;
        """

        params = (provider_id, provider, display_name, username, email, avatar)

        with self.get_cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def get_user_by_id(self, uid):
        sql = "SELECT * FROM users WHERE uid = %s;"
        with self.get_cursor() as cur:
            cur.execute(sql, (uid,))
            return cur.fetchone()
