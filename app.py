from flask import Flask, render_template, request, session, jsonify, redirect, url_for
import os, requests
from dotenv import load_dotenv
from services import AnimeDataClient, StreamClient
import database
db = database.UserManager()

load_dotenv()

CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
REDIRECT_URI = os.getenv('DISCORD_REDIRECT_URI')
AUTHORIZATION_BASE_URL = 'https://discord.com/api/oauth2/authorize'
TOKEN_URL = 'https://discord.com/api/oauth2/token'
USER_INFO_URL = 'https://discord.com/api/users/@me'
OS_ENV = os.environ.get("OAUTHLIB_INSECURE_TRANSPORT")

# Allow HTTP for local testing
if OS_ENV is None:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# Initialize Clients
anime_client = AnimeDataClient()
stream_client = StreamClient()

# Home page
@app.route('/')
def index():
    spotlight = anime_client.get_spotlight()
    recent_episodes = anime_client.get_recent_episodes()
    new_releases = anime_client.get_new_releases()
    upcoming = anime_client.get_top_upcoming()
    latest_completed = anime_client.get_latest_completed()
    schedule = anime_client.get_schedule()
    # Ensure allow iteration even if empty
    return render_template('index.html', 
                         spotlight=spotlight,
                         recent_episodes=recent_episodes,
                         new_releases=new_releases,
                         upcoming=upcoming,
                         latest_completed=latest_completed,
                         schedule=schedule)

# Search anime
@app.route('/search')
def search():
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    if not query:
        # Fallback to specials if no query, preserving original logic
        results = anime_client.fetch('specials', {"page": page})
        return render_template('search.html', page=page, query='', results=results)
    
    results = anime_client.search(query, page)
    
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
    
    data = anime_client.get_search_suggestions(query)
    return jsonify(data if data else [])

# Anime details page
@app.route('/anime/<anime_id>')
def anime_info(anime_id):
    info = anime_client.get_info(anime_id)
    
    if not info:
        return render_template('error.html', message="Anime not found"), 404
    
    # Fetch popular data for the sidebar
    most_popular = anime_client.get_spotlight()    
    return render_template('anime_info.html', anime=info, most_popular=most_popular)

# Watch episode
@app.route('/watch/<episode_id>')
def watch(episode_id):
    ep = request.args.get('ep', '1')
    dub = request.args.get('dub', 'false').lower() == 'true'
    category = "dub" if dub else "sub"
    try:
        # Call Stream Client
        api_response = stream_client.get_stream_data(episode_id, category, ep)

        if not api_response or not api_response.get("ok") or api_response.get("count") == 0:
             # If stream fails, we might still want to show the page but with an error message
             # But original logic returned 503.
            return render_template('error.html', message="Streaming service unavailable", alt_link="https://anikai.to/watch/" + episode_id + "#ep=" + ep), 503

        # We need anime info for the breadcrumbs/details on the watch page
        anime_details = anime_client.get_info(episode_id)
        
        return render_template(
            'watch.html',
            **api_response, 
            current_episode=ep,
            is_dub=dub,
            episode_id=episode_id,
            anime_info=anime_details if anime_details else {},
        )

    except Exception as e:
        print(f"Flask Error in watch: {e}")
        return render_template('error.html', message="Internal Server Error"), 500

# Browse by category
@app.route('/browse/<category>')
def browse(category):
    page = request.args.get('page', 1, type=int)
    
    valid_categories = ['movies', 'tv', 'ova', 'ona', 'specials', 
                       'recent-episodes', 'recent-added', 'new-releases', 
                       'latest-completed']
    
    if category not in valid_categories:
        return render_template('error.html', message="Invalid category"), 404
    
    data = anime_client.get_by_category(category, page)
    return render_template('browse.html', 
                         data=data,
                         category=category,
                         page=page)

# Browse by genre
@app.route('/genre/<genre_name>')
def browse_genre(genre_name):
    page = request.args.get('page', 1, type=int)
    
    data = anime_client.get_by_genre(genre_name, page)
    return render_template('browse.html', 
                         data=data,
                         category=genre_name, # Reusing category for title display
                         page=page,
                         is_genre=True)

# API endpoint for dynamic loading
@app.route('/api/anime/<anime_id>')
def api_anime_info(anime_id):
    info = anime_client.get_info(anime_id)
    return jsonify(info if info else {})

# API endpoint for streaming links
@app.route('/api/search-suggestions/<search>')
def api_search_suggest(search):
    # This route name is confusing in original code vs 'suggestions' route.
    # Original: fetch_api(f'search-suggestions/{search}')
    # It might be an alternative way to search.
    data = anime_client.fetch(f'search-suggestions/{search}')
    return jsonify(data if data else {})

@app.route('/api/watch/<episode_id>')
def api_watch(episode_id):
    dub = request.args.get('dub', 'false').lower() == 'true'
    category = "dub" if dub else "sub"
    streams = stream_client.get_stream_data(episode_id, category, request.args.get('ep', '1'))
    return jsonify(streams if streams else {})

@app.route('/profile')
def profile():
    if not session.get('user', None):
        return redirect(url_for('login'))
    return render_template('profile.html')

@app.route('/login')
def login():
    if not session.get('user', None):
        scope = 'identify email'
        discord_login_url = f"{AUTHORIZATION_BASE_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope={scope}"
        return redirect(discord_login_url)
    return redirect(url_for('index'))
    

@app.route('/auth/discord/callback')
def callback():
    if 'error' in request.args:
        return jsonify({'error': request.args['error']})

    if 'code' in request.args:
        code = request.args['code']
        
        # Exchange code for access token
        data = {
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI
        }
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(TOKEN_URL, data=data, headers=headers)
        response.raise_for_status()
        tokens = response.json()
        access_token = tokens['access_token']

        # Get user info
        user_headers = {
            'Authorization': f"Bearer {access_token}"
        }
        user_response = requests.get(USER_INFO_URL, headers=user_headers)
        user_response.raise_for_status()
        user_data = user_response.json()
        # print(user_data)
        db.sync_oauth_user(
            provider="discord",
            provider_id=user_data['id'],
            display_name=user_data['global_name'],
            username=user_data['username'],
            email=user_data['email'],
            avatar=user_data['avatar']
        )
        session['user'] = user_data
        return redirect(url_for('index'))
    
    return 'Unknown Error', 400

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return render_template('error.html', message="Page not found"), 404

@app.errorhandler(500)
def internal_error(e):  
    return render_template('error.html', message="Internal server error"), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)