import os
import logging
import requests
import urllib.request
import urllib.error
import json
from dotenv import load_dotenv
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

load_dotenv()

logger = logging.getLogger(__name__)

# Cache configuration
api_cache = TTLCache(maxsize=200, ttl=300)


def make_cache_key(endpoint, params=None):
    if params is None:
        return hashkey(endpoint)
    return hashkey(endpoint, tuple(sorted(params.items())) if params else None)


def _extract_results(data, fallback=None):
    """Safely extract results from API response data.
    Returns data['results'] if dict, data itself if list, or fallback."""
    if fallback is None:
        fallback = []
    if isinstance(data, dict):
        return data.get('results', fallback)
    return data if data else fallback


class BaseClient:
    def __init__(self, base_url):
        self.base_url = base_url

    def _get(self, endpoint, params=None, unsafe=False):
        """Internal get method with error handling."""
        if not self.base_url:
            logger.error("Base URL not configured for %s", self.__class__.__name__)
            return None

        try:
            url = f"{self.base_url}/{endpoint}"
            logger.info("[%s] Fetching: %s Params: %s", self.__class__.__name__, url, params)
            
            if unsafe:
                # Bypass automatic URL encoding using urllib
                logger.info("Using unsafe URL mode (urllib) for: %s", url)
                with urllib.request.urlopen(url, timeout=10) as response:
                    status_code = response.getcode()
                    if 200 <= status_code < 300:
                        return json.loads(response.read().decode('utf-8'))
                    else:
                        raise requests.exceptions.HTTPError(f"HTTP {status_code}")
            else:
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                return response.json()
        except (requests.exceptions.RequestException, urllib.error.URLError) as e:
            logger.error("[%s] API Error: %s", self.__class__.__name__, e)
            return None


class AnimeDataClient(BaseClient):
    """Client for general anime data (Spotlight, Search, Info)."""

    def __init__(self):
        super().__init__(os.getenv('BASE_URL'))

    @cached(api_cache, key=lambda self, endpoint, params=None, unsafe=False: make_cache_key(endpoint, params))
    def fetch(self, endpoint, params=None, unsafe=False):
        """
        Fetches data from the anime API.
        Returns a list or dict depending on endpoint.
        Safely returns None on failure to let callers handle it.
        """
        data = self._get(endpoint, params, unsafe=unsafe)
        if data is None:
            logger.warning("No data received for endpoint '%s'", endpoint)
            return None
        return data

    def get_spotlight(self):
        """Trending anime for hero/spotlight section."""
        data = self.fetch('trending', {'page': 1, 'perPage': 10})
        return _extract_results(data)

    def get_recent_episodes(self):
        """Currently airing anime (latest episodes via advanced search)."""
        data = self.fetch('advanced-search', {
            'status': 'RELEASING',
            'sort': '["UPDATED_AT_DESC"]',
            'perPage': 20
        })
        return _extract_results(data)

    def get_new_releases(self):
        """Popular anime (replaces old new-releases)."""
        data = self.fetch('popular', {'page': 1, 'perPage': 20})
        return _extract_results(data)

    def get_top_upcoming(self):
        """Upcoming anime via advanced search."""
        data = self.fetch('advanced-search', {
            'status': 'NOT_YET_RELEASED',
            'sort': '["POPULARITY_DESC"]',
            'perPage': 20
        })
        return _extract_results(data)

    def get_favourites(self):
        """All-time favourite anime via advanced search."""
        data = self.fetch('advanced-search', {
            'sort': '["FAVOURITES_DESC"]',
            'perPage': 20
        })
        return _extract_results(data)

    def get_latest_completed(self):
        """Recently finished anime via advanced search."""
        data = self.fetch('advanced-search', {
            'status': 'FINISHED',
            'sort': '["END_DATE_DESC"]',
            'perPage': 20
        })
        return _extract_results(data)

    def get_schedule(self, day=None):
        """Fetch airing schedule."""
        params = {'perPage': 50}
        if day is not None:
            params['day'] = day
        data = self.fetch('airing-schedule', params)
        return data if data else {'results': []}

    def get_schedule_by_day(self, day_num):
        return self.get_schedule(day=day_num)

    def search(self, query, page=1):
        """Search anime by title. GET /meta/anilist/{query}?page={page}"""
        if not query:
            return {'results': []}
        params = {'page': page} if page > 1 else None
        data = self.fetch(query, params)
        return data if data else {'results': []}

    def get_search_suggestions(self, query):
        """Use simple search for suggestions."""
        if not query:
            return []
        data = self.fetch(query, {'perPage': 8})
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data if data else []

    def get_info(self, anime_id):
        """Get full anime info. GET /meta/anilist/info/{id}"""
        data = self.fetch(f'info/{anime_id}')
        return data

    def get_by_category(self, category, page=1):
        """Browse by category using advanced search with format mapping."""
        category_map = {
            'movies': {'format': 'MOVIE'},
            'tv': {'format': 'TV'},
            'ova': {'format': 'OVA'},
            'ona': {'format': 'ONA'},
            'specials': {'format': 'SPECIAL'},
            'recent-episodes': {},
            'recent-added': {'sort': '["UPDATED_AT_DESC"]'},
            'new-releases': {'sort': '["START_DATE_DESC"]'},
            'latest-completed': {'status': 'FINISHED', 'sort': '["END_DATE_DESC"]'},
        }

        if category == 'recent-episodes':
            data = self.fetch('recent-episodes', {'page': page, 'perPage': 20})
            return data if data else []

        params = {'page': page, 'perPage': 20}
        params.update(category_map.get(category, {}))
        data = self.fetch('advanced-search', params)
        return data if data else []

    def get_by_genre(self, genre, page=1):
        """Browse by genre using advanced search.
        Manually constructing URL to prevents requests from encoding [ ] characters.
        """
        # Ensure genre is capitalized for AniList API
        formatted_genre = genre.capitalize() if genre else genre
        
        query = f'genres=["{formatted_genre}"]&sort=["POPULARITY_DESC"]&perPage=20&page={page}'
        endpoint = f'advanced-search?{query}'
        data = self.fetch(endpoint, unsafe=True)
        return data if data else {}

    def get_random_anime(self):
        """Fetch a random anime."""
        data = self.fetch('random-anime')
        if isinstance(data, dict):
            return data
        if isinstance(data, list) and data:
            return data[0]
        return None


class StreamClient(BaseClient):
    """Client for streaming links and DB interactions."""

    def __init__(self):
        super().__init__(os.getenv('STREAM_URL'))

    @cached(api_cache, key=lambda self, episode_id, category='sub', ep_num='1': make_cache_key(
        f"stream_{episode_id}", {'category': category, 'ep': ep_num}
    ))
    def get_stream_data(self, episode_id, category='sub', ep_num='1'):
        """Fetches streaming data."""
        params = {'ep': ep_num, 'category': category}
        data = self._get(episode_id, params)
        return data
