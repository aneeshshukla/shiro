from flask import Flask, render_template, request, jsonify
import requests
from functools import lru_cache
import os
from dotenv import load_dotenv

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# Base URL for Anime API
BASE_URL = os.getenv('BASE_URL')

# Cache API responses for better performance
@lru_cache(maxsize=100)
def fetch_api(endpoint, params=None):
    """Fetch data from API with caching"""
    try:
        url = f"{BASE_URL}/{endpoint}"
        print(url)
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        return None

# Home page
@app.route('/')
def index():
    spotlight = fetch_api('spotlight')
    recent_episodes = fetch_api('recent-episodes')
    new_releases = fetch_api('new-releases')
    upcoming = fetch_api('schedule/today')
    latest_completed = fetch_api('latest-completed')
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
        return render_template('search.html',page=page,query='', results=fetch_api('recent-episodes'))
    
    results = fetch_api(query)
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
    
    data = fetch_api('suggestions', {'query': query})
    return jsonify(data if data else [])

# Anime details page
@app.route('/anime/<anime_id>')
def anime_info(anime_id):
    info = fetch_api(f'info?id={anime_id}')
    if not info:
        return render_template('error.html', 
                             message="Anime not found"), 404
    return render_template('anime_info.html', anime=info)

# Watch episode
@app.route('/watch/<episode_id>')
def watch(episode_id):
    dub = request.args.get('dub', 'false').lower() == 'true'
    
    # Get streaming links
    streams = fetch_api(f'watch/{episode_id}', {'dub': dub})
    
    # Get available servers
    servers = fetch_api(f'servers/{episode_id}', {'dub': dub})
    
    if not streams:
        return render_template('error.html', 
                             message="Episode not found"), 404
    
    return render_template('watch.html', 
                         streams=streams,
                         servers=servers,
                         episode_id=episode_id,
                         is_dub=dub)

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
    
    data = fetch_api(category)
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
    info = fetch_api(f'info/{anime_id}')
    return jsonify(info if info else {})

# API endpoint for streaming links
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