import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

class UserManager:
    def __init__(self):
        # Create a connection pool
        # minconn=1, maxconn=10 (adjust as needed)
        self.pool = SimpleConnectionPool(
            minconn=1, 
            maxconn=10, 
            dsn=DATABASE_URL
        )

    @contextmanager
    def get_cursor(self):
        conn = self.pool.getconn()
        conn.autocommit = True
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
        finally:
            self.pool.putconn(conn)

    def sync_oauth_user(self, provider, provider_id, display_name, username, email, avatar):
        """
        Syncs data with the table containing separate google/discord columns.
        """
        # Map the provider to the correct table columns
        if provider == "google":
            id_col = "google_id"
            email_col = "google_email"
            avatar_col = "google_avatar"
            user_col = "display_name" # Google doesn't usually have a separate 'username'
        else:
            id_col = "discord_id"
            email_col = "discord_email"
            avatar_col = "discord_avatar"
            user_col = "discord_username"

        # We use 'original_provider' for the first-time insert
        # We use EXCLUDED to update profile info on every login
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

    def close(self):
        if hasattr(self, 'pool') and self.pool:
            self.pool.closeall()