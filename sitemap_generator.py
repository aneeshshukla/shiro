def generate_sitemap_xml(base_url):
    # Static pages
    pages = [
        '/login',
        '/terms-of-service',
        '/privacy-policy',
        '/search',
        '/profile',
        '/schedule',
        '/random'
    ]
    
    # Dynamic categories
    categories = [
        '/browse/movies',
        '/browse/tv',
        '/browse/ova',
        '/browse/ona',
        '/browse/specials',
        '/browse/recent-episodes',
        '/browse/new-releases',
        '/browse/latest-completed'
    ]

    # Genres
    genres = [
        'action', 'adventure', 'cars', 'comedy', 'dementia', 'demons', 'drama', 
        'ecchi', 'fantasy', 'game', 'harem', 'historical', 'horror', 'josei', 
        'kids', 'magic', 'martial-arts', 'mecha', 'military', 'music', 'mystery', 
        'parody', 'police', 'psychological', 'romance', 'samurai', 'school', 
        'sci-fi', 'seinen', 'shoujo', 'shoujo-ai', 'shounen', 'shounen-ai', 
        'slice-of-life', 'space', 'sports', 'super-power', 'supernatural', 
        'thriller', 'vampire', 'yaoi', 'yuri'
    ]
    
    xml_content = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_content.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    
    # Add Home page (Highest priority)
    xml_content.append('<url>')
    xml_content.append(f'<loc>{base_url}</loc>')
    xml_content.append('<changefreq>daily</changefreq>')
    xml_content.append('<priority>1.0</priority>')
    xml_content.append('</url>')
    
    # Add static pages
    for page in pages:
        xml_content.append('<url>')
        xml_content.append(f'<loc>{base_url}{page}</loc>')
        xml_content.append('<changefreq>daily</changefreq>')
        xml_content.append('<priority>0.8</priority>')
        xml_content.append('</url>')

    # Add categories
    for cat in categories:
        xml_content.append('<url>')
        xml_content.append(f'<loc>{base_url}{cat}</loc>')
        xml_content.append('<changefreq>daily</changefreq>')
        xml_content.append('<priority>0.6</priority>')
        xml_content.append('</url>')

    # Add genres
    for genre in genres:
        xml_content.append('<url>')
        xml_content.append(f'<loc>{base_url}/genre/{genre}</loc>')
        xml_content.append('<changefreq>weekly</changefreq>')
        xml_content.append('<priority>0.7</priority>')
        xml_content.append('</url>')
        
    xml_content.append('</urlset>')
    
    return '\n'.join(xml_content)
