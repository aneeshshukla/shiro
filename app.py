from flask import Flask, render_template, request, session, jsonify, redirect, url_for, Response
import os
import logging
import atexit
import requests
from dotenv import load_dotenv
from services import AnimeDataClient, StreamClient
import database

load_dotenv()

logger = logging.getLogger(__name__)

try:
    db = database.UserManager()
except Exception as e:
    logger.error("Failed to initialize database: %s", e)
    db = None

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
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or os.urandom(24).hex()

# Initialize Clients
anime_client = AnimeDataClient()
stream_client = StreamClient()

# Cleanup DB pool on shutdown
def cleanup():
    if db:
        db.close()
atexit.register(cleanup)

# Home page

# Security: API Origin Check
@app.before_request
def check_api_origin():
    if request.path.startswith('/api/'):
        allowed_sites = os.environ.get('ALLOWED_SITES', '').split(',')
        if not allowed_sites or allowed_sites == ['']:
            return # No restriction if env not set

        allowed = [s.strip().rstrip('/') for s in allowed_sites if s.strip()]
        if not allowed:
            return

        origin = request.headers.get('Origin')
        referer = request.headers.get('Referer')

        # Allow if Origin matches
        if origin and origin.rstrip('/') in allowed:
            return

        # Allow if Referer starts with allowed site
        if referer and any(referer.startswith(s) for s in allowed):
            return

        # Block if no match (or missing headers)
        logger.warning("Blocked API request from Origin: %s, Referer: %s", origin, referer)
        return jsonify({'error': 'Unauthorized Origin/Referer'}), 403

@app.route('/')
def index():
    # Render template immediately with no data (Client-side will fetch)
    return render_template('index.html', 
                         current_page='home',
                         spotlight=None,
                         recent_episodes=None,
                         new_releases=None,
                         upcoming=None,
                         latest_completed=None,
                         schedule=None)

# --- API Endpoints for Home Page Hydration ---

@app.route('/api/home/spotlight')
def api_home_spotlight():
    data = anime_client.get_spotlight()
    return jsonify(data if data else [])

@app.route('/api/home/recent-episodes')
def api_home_recent():
    data = anime_client.get_recent_episodes()
    return jsonify(data if data else {})

# @app.route('/api/genre/<genre>')
# def api_home_genre(genre):
#     data = anime_client.get_genre(genre)
#     return jsonify(data if data else {})

@app.route('/api/home/new-releases')
def api_home_new_releases():
    data = anime_client.get_new_releases()
    return jsonify(data if data else {})

@app.route('/api/home/upcoming')
def api_home_upcoming():
    data = anime_client.get_top_upcoming()
    return jsonify(data if data else {})

@app.route('/api/home/completed')
def api_home_completed():
    data = anime_client.get_latest_completed()
    return jsonify(data if data else {})

@app.route('/api/home/favourites')
def api_home_favourites():
    data = anime_client.get_favourites()
    return jsonify(data if data else {})

@app.route('/api/home/schedule')
def api_home_schedule():
    day = request.args.get('day', None, type=int)
    data = anime_client.get_schedule(day=day)
    return jsonify(data if data else {})

# Schedule page
@app.route('/schedule')
def schedule():
    return render_template('schedule.html', current_page='schedule')

@app.route('/api/schedule/<day>')
def api_schedule_day(day):
    try:
        day_num = int(day)
    except ValueError:
        day_num = None
    data = anime_client.get_schedule(day=day_num)
    return jsonify(data if data else {})

# Search anime
@app.route('/search')
def search():
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    if not query:
        # Fallback to specials if no query, preserving original logic
        results = anime_client.fetch('specials', {"page": page})
        return render_template('search.html', current_page='search', page=page, query='', results=results)
    
    results = anime_client.search(query, page)
    
    return render_template('search.html', 
                         current_page='search',
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
    return render_template('anime_info.html', current_page='', anime=info, most_popular=most_popular)

# Watch episode
@app.route('/watch/<anime_id>')
def watch(anime_id):
    ep = request.args.get('ep', '1')
    server = 'hd-1'
    category = 'sub'
    try:
        # Call Stream Client
        api_response = stream_client.get_stream_data(anime_id, category, ep, server)

        if not api_response or not api_response.get("ok") or api_response.get("count") == 0:
             # If stream fails, we might still want to show the page but with an error message
            return render_template('error.html', message="Streaming service unavailable", alt_link="https://anikai.to/watch/" + anime_id + "#ep=" + ep), 503

        # We need anime info for the breadcrumbs/details on the watch page
        anime_details = anime_client.get_info(anime_id)
        
        return render_template(
            'watch.html',
            **api_response, 
            current_episode=ep,
            current_server=server,
            is_dub=False,
            episode_id=anime_id,
            anime_info=anime_details if anime_details else {}
        )

    except Exception as e:
        logger.error("Flask Error in watch: %s", e)
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
                         current_page='search',
                         data=data,
                         category=category,
                         page=page)

# Browse by genre
@app.route('/genre/<genre_name>')
def browse_genre(genre_name):
    page = request.args.get('page', 1, type=int)
    
    data = anime_client.get_by_genre(genre_name, page)
    return render_template('browse.html', 
                         current_page='search',
                         data=data,
                         category=genre_name,
                         page=page,
                         is_genre=True)

# Random Anime
@app.route('/random')
def random_anime():
    try:
        data = anime_client.get_random_anime()
        if data and isinstance(data, dict) and 'id' in data:
            return redirect(url_for('anime_info', anime_id=data['id']))
        return redirect(url_for('index'))
    except Exception as e:
        logger.error("Error fetching random anime: %s", e)
        return redirect(url_for('index'))

# API endpoint for dynamic loading
@app.route('/api/anime/<anime_id>')
def api_anime_info(anime_id):
    info = anime_client.get_info(anime_id)
    return jsonify(info if info else {})

# API endpoint for streaming links

@app.route('/api/watch/<animeid>')
def api_watch(animeid):
    ep = request.args.get('ep', '1')
    server = request.args.get('server', 'hd-1')
    dub = request.args.get('dub', 'false').lower() == 'true'
    category = "dub" if dub else "sub"
    streams_data = stream_client.get_stream_data(animeid, category, ep, server)
    return jsonify(streams_data if streams_data else {})

@app.route('/profile')
def profile():
    if not session.get('user', None):
        return redirect(url_for('login'))
    return render_template('profile.html', current_page='profile')

@app.route('/login')
def login():
    if session.get('user', None):
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/auth/discord')
def auth_discord():
    if session.get('user', None):
        return redirect(url_for('index'))
    scope = 'identify email'
    discord_login_url = f"{AUTHORIZATION_BASE_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope={scope}"
    return redirect(discord_login_url)
    

@app.route('/auth/discord/callback')
def callback():
    if 'error' in request.args:
        return jsonify({'error': request.args['error']})

    if 'code' in request.args:
        code = request.args['code']
        
        try:
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

            if db:
                db.sync_oauth_user(
                    provider="discord",
                    provider_id=user_data['id'],
                    display_name=user_data.get('global_name') or user_data.get('username', ''),
                    username=user_data.get('username', ''),
                    email=user_data.get('email', ''),
                    avatar=user_data.get('avatar', '')
                )
            else:
                logger.warning("Database unavailable, skipping user sync")
            session['user'] = user_data
            return redirect(url_for('index'))
        
        except requests.exceptions.RequestException as e:
            logger.error("Discord OAuth Error: %s", e)
            return redirect(url_for('login'))
    
    return 'Unknown Error', 400

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

@app.route('/terms-of-service')
def terms():
    return render_template('terms.html')

@app.route('/privacy-policy')
def privacy():
    return render_template('privacy.html')

@app.route('/sitemap.xml')
def sitemap():
    from sitemap_generator import generate_sitemap_xml
    base_url = request.url_root.rstrip('/')
    xml_content = generate_sitemap_xml(base_url)
    return Response(xml_content, mimetype='application/xml')

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return render_template('error.html', message="Page not found"), 404

@app.errorhandler(500)
def internal_error(e):  
    return render_template('error.html', message="Internal server error"), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)