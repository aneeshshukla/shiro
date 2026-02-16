# Shiro - Anime Streaming Platform

Shiro is a modern, responsive web application for streaming anime, built with Flask. It features a sleek dark-themed UI, real-time schedules, and a seamless watching experience.

![Shiro Preview](static/preview.png)

## Features

- **📺 Modern UI/UX**: Fully responsive "SHIRO" dark theme with glassmorphism effects and smooth animations.
- **� Discord OAuth**: Secure user authentication via Discord to save progress and access personalized features.
- **👤 User Profiles**: Dedicated user profiles to manage settings and view watch history.
- **�📅 Interactive Schedule**: Real-time weekly schedule widget with date navigation.
- **🔎 Advanced Search**: Instant search suggestions and genre filtering.
- **⏯️ Immersive Player**: Cinematic watch page with "Focus Mode," auto-play controls, and server selection.
- **📱 Mobile Optimized**: Mobile-first design for browsing and watching on the go.
- **⚡ High Performance**: Efficient caching strategy using `cachetools` and robust database connection pooling with `psycopg2`.

## Tech Stack

- **Backend**: Python, Flask, Gunicorn
- **Database**: PostgreSQL (Neon DB)
- **Frontend**: HTML5, CSS3, JavaScript (No frameworks, pure performance)
- **Utilities**: `python-dotenv` for config, `requests` for API handling, `cachetools` for caching, `psycopg2` for DB connectivity.
- **Comparison**: Built as a lightweight alternative to heavy SPA frameworks.

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aneeshshukla/shiro.git
   cd shiro
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate

   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Flask Config
   SECRET_KEY=your_secret_key_here
   
   # Data & Streaming APIs
   BASE_URL=https://api.consumet.org/anime/<service-provider>
   STREAM_URL=https://<streaming-api-url>

   # Database (PostgreSQL/Neon)
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

   # Discord OAuth
   CLIENT_ID=your_discord_client_id
   CLIENT_SECRET=your_discord_client_secret
   DISCORD_REDIRECT_URI=http://localhost:5000/auth/discord/callback
   ```

5. **Run the application**
   ```bash
   python app.py
   ```
   Visit `http://localhost:5000` in your browser.

## Deployment

The project includes a `vercel.json` configuration for easy deployment to Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/aneeshshukla/shiro)

## Project Structure

```
shiro/
├── app.py              # Main Flask application entry point
├── database.py         # Database connection and user management
├── services.py         # API Client and Caching logic
├── requirements.txt    # Python dependencies
├── static/             # CSS, JS, and Images
│   ├── css/            # Page-specific stylesheets
│   └── js/             # Frontend interactions
├── templates/          # Jinja2 HTML templates
└── .env                # Environment variables
```

## License

This project is open source and available under the [MIT License](LICENSE).

---
*Note: This project is for educational purposes only. It scrapes data from third-party sources and does not host any content.*
