import os
import requests
from dotenv import load_dotenv
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

load_dotenv()

# Cache configuration
# We can use separate caches if needed, or a shared one. 
# Given the high read nature, caching is good.
api_cache = TTLCache(maxsize=200, ttl=300)

def make_cache_key(endpoint, params=None):
    if params is None:
        return hashkey(endpoint)
    # Convert params to a sorted tuple of items to be hashable
    return hashkey(endpoint, tuple(sorted(params.items())) if params else None)

class BaseClient:
    def __init__(self, base_url):
        self.base_url = base_url

    def _get(self, endpoint, params=None):
        """Internal get method with error handling."""
        if not self.base_url:
            print(f"Error: Base URL not configured for {self.__class__.__name__}")
            return None

        try:
            url = f"{self.base_url}/{endpoint}"
            print(f"[{self.__class__.__name__}] Fetching: {url} Params: {params}")
            response = requests.get(url, params=params, timeout=10) # Added timeout
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[{self.__class__.__name__}] API Error: {e}")
            return None

class AnimeDataClient(BaseClient):
    """Client for general anime data (Spotlight, Search, Info)."""
    
    def __init__(self):
        super().__init__(os.getenv('BASE_URL'))

    @cached(api_cache, key=lambda self, endpoint, params=None: make_cache_key(endpoint, params))
    def fetch(self, endpoint, params=None):
        """
        Fetches data from the anime API.
        Returns a list or dict depending on endpoint.
        Safely returns empty list/dict on failure to prevent crashes.
        """
        data = self._get(endpoint, params)
        if data is None:
            print(f"[Services] Warning: No data received for endpoint '{endpoint}'")
            # Default fallback based on expected return types could be complex,
            # but returning None allows the caller to handle 404s if needed,
            # OR we return empty structures. 
            # App.py was blindly accessing [0], implying it expected a list.
            # let's return None here and handle it in the service methods below.
            return None
        return data

    def get_spotlight(self):
        data = self.fetch('spotlight')
        return data if data else []

    def get_recent_episodes(self):
        data = self.fetch('recent-episodes')
        return data if data else []

    def get_new_releases(self):
        data = self.fetch('new-releases')
        return data if data else []

    def get_top_upcoming(self):
        data = self.fetch('top-upcoming')
        return data if data else []

    def get_latest_completed(self):
        data = self.fetch('latest-completed')
        return data if data else []

    def get_schedule(self):
        data = self.fetch('schedule/today')
        return data if data else []

    def search(self, query, page=1):
        if not query:
            return {'results': []} # mimics structure
        
        # Original code did fetch_api(query). 
        # Assuming the API supports /{query} as a search path or similar.
        # If it's a standard consumet API, it usually uses /{marketing_path}/{query} 
        # But complying with user's original logic:
        data = self.fetch(query, params={'page': page} if page > 1 else None)
        return data if data else {'results': []}

    def get_search_suggestions(self, query):
        if not query:
            return []
        data = self.fetch('search-suggestions', {'query': query})
        return data if data else []

    def get_info(self, anime_id):
        data = self.fetch('info', {'id': anime_id})
        return data

    def get_by_category(self, category, page=1):
        data = self.fetch(category, params={'page': page} if page > 1 else None)
        return data if data else []

    def get_by_genre(self, genre, page=1):
        # User specified base_URL/genre/action structure
        data = self.fetch(f'genre/{genre}', params={'page': page})
        return data if data else {}


class StreamClient(BaseClient):
    """Client for streaming links and DB interactions."""

    def __init__(self):
        super().__init__(os.getenv('STREAM_URL'))

    @cached(api_cache, key=lambda self, episode_id, category='sub', ep_num='1': make_cache_key(f"stream_{episode_id}", {'category': category, 'ep': ep_num}))
    def get_stream_data(self, episode_id, category='sub', ep_num='1'):
        """
        Fetches streaming data.
        """
        params = {'ep': ep_num, 'category': category}
        data = self._get(episode_id, params)
        return data
