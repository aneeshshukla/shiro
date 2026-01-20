from flask import Flask, render_template, request, jsonify, redirect
import requests
# from functools import lru_cache
import os
from dotenv import load_dotenv
from cachetools import TTLCache, cached
from cachetools.keys import hashkey
import urllib.parse

cache = TTLCache(maxsize=100, ttl=180)

load_dotenv() 

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# Base URL for Anime API
BASE_URL = os.getenv('BASE_URL')
STREAM_URL = os.getenv('STREAM_URL')

def make_cache_key(endpoint, params=None):
    if params is None:
        return hashkey(endpoint)
    return hashkey(endpoint, tuple(sorted(params.items())))

@cached(cache, key=make_cache_key)
def fetch_api(endpoint, params=None):
    try:
        url = f"{BASE_URL}/{endpoint}"
        print("Fetching:", url, "Params:", params)

        response = requests.get(url, params=params)
        return response.json(),response.status_code
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        return None
    

@cached(cache, key=make_cache_key)
def fetch_stream_api(endpoint, params=None):
    try:
        url = f"{STREAM_URL}/{endpoint}"
        print("Fetching:", url, "Params:", params)

        response = requests.get(url, params=params)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        return None


# Home page
@app.route('/')
def index():
    spotlight = fetch_api('spotlight')[0]
    recent_episodes = fetch_api('recent-episodes')[0]
    new_releases = fetch_api('new-releases')[0]
    upcoming = fetch_api('top-upcoming')[0]
    latest_completed = fetch_api('latest-completed')[0]
    return render_template('index.html', 
                         spotlight=spotlight,
                         recent_episodes=recent_episodes,
                         new_releases=new_releases,
                         upcoming=upcoming,
                         latest_completed=latest_completed)

# Search anime
@app.route('/search')
def search():
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    
    if not query:
        return render_template('search.html',page=page,query='', results=fetch_api('specials', {"page": request.args.get('page', '1')})[0])
    
    results = fetch_api(query)[0]
    return render_template('search.html', 
                         results=results, 
                         query=query,
                         page=page)

# Get search suggestions (AJAX)
@app.route('/api/suggestions')
def suggestions():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    data = fetch_api('search-suggestions', {'query': query})[0]
    return jsonify(data if data else [])

# Anime details page
@app.route('/anime/<anime_id>')
def anime_info(anime_id):
    info = fetch_api('info', {"id": anime_id})
    print(info[1])
    if not info or info[1]!=200:
        return render_template('error.html', 
                             message="Anime not found"), 404
    return render_template('anime_info.html', anime=info[0])

# Watch episode
@app.route('/watch/<episode_id>')
def watch(episode_id):
    ep = request.args.get('ep', '1')
    dub = request.args.get('dub', 'false').lower() == 'true'
    category = "dub" if dub else "sub"
    
    try:
        # Call FastAPI
        # Note: We pass both 'ep' and 'category' to let the API do the filtering
        params = {'ep': ep, 'category': category}
        print(params)
        response = fetch_stream_api(episode_id,params)
        # response = requests.get(api_url, params=params)
        api_response = response

        if not api_response or not api_response.get("ok"):
            return render_template('error.html', message="Streaming service unavailable"), 503

        # We pass the api_response keys (streams, servers, anime_title) 
        # directly into the template context using **
        print(api_response["streams"]['sources'][0]["url"])
        return render_template(
            'watch.html',
            **api_response, 
            current_episode=ep,
            is_dub=dub,
            episode_id=episode_id,
            anime_info = fetch_api('info', {"id": episode_id})[0]
        )

    except Exception as e:
        print(f"Flask Error: {e}")
        return render_template('error.html', message="Internal Server Error"), 500

# Browse by category
@app.route('/browse/<category>')
def browse(category):
    page = request.args.get('page', 1, type=int)
    
    valid_categories = ['movies', 'tv', 'ova', 'ona', 'specials', 
                       'recent-episodes', 'recent-added', 'new-releases', 
                       'latest-completed']
    
    if category not in valid_categories:
        return render_template('error.html', 
                             message="Invalid category"), 404
    
    data = fetch_api(category)[0]
    return render_template('browse.html', 
                         data=data,
                         category=category,
                         page=page)

# Browse by genre
# @app.route('/genre')
# def genre():
#     genre_name = request.args.get('genre', '')
#     page = request.args.get('page', 1, type=int)
    
#     if not genre_name:
#         # Show genre list
#         genres = fetch_api('genre-list')
#         return render_template('genres.html', genres=genres)
    
#     # Show anime by genre
#     data = fetch_api('genre', {'genre': genre_name, 'page': page})
#     return render_template('browse.html', 
#                          data=data,
#                          category=f'Genre: {genre_name}',
#                          page=page)

# # Schedule page
# @app.route('/schedule')
# def schedule():
#     schedule_data = fetch_api('schedule')
#     return render_template('schedule.html', schedule=schedule_data)

# API endpoint for dynamic loading
@app.route('/api/anime/<anime_id>')
def api_anime_info(anime_id):
    info = fetch_api(f'info',{'id': anime_id})[0]
    return jsonify(info if info else {})

# API endpoint for streaming links
@app.route('/api/search-suggestions/<search>')
def api_search_suggest(search):
    # dub = request.args.get('dub', 'false').lower() == 'true'
    streams = fetch_api(f'search-suggestions/{search}')[0]
    return jsonify(streams if streams else {})

@app.route('/api/watch/<episode_id>')
def api_watch(episode_id):
    dub = request.args.get('dub', 'false').lower() == 'true'
    streams = fetch_api(f'watch/{episode_id}', {'dub': dub})
    return jsonify(streams if streams else {})

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return render_template('error.html', 
                         message="Page not found"), 404

@app.errorhandler(500)
def internal_error(e):
    return render_template('error.html', 
                         message="Internal server error"), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)