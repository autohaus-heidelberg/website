import type { Event } from "./events";

export function eventHash(e: Event) {
    return hashCode(`${e.date}${e.title}`);
}

function hashCode(str: string) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}

/**
 * Converts a standard YouTube URL to an embed URL
 * Handles various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID (already embed format)
 */
export function convertToYouTubeEmbed(url: string): string {
    if (!url) return url;
    
    // Remove any trailing whitespace
    url = url.trim();
    
    // Already an embed URL
    if (url.includes('/embed/')) {
        // Remove tracking parameters if present
        return url.split('?')[0];
    }
    
    let videoId = '';
    
    // Handle youtu.be short links
    if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
    }
    // Handle standard watch URLs
    else if (url.includes('watch?v=')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        videoId = urlParams.get('v') || '';
    }
    // Handle /v/ format
    else if (url.includes('/v/')) {
        videoId = url.split('/v/')[1]?.split('?')[0]?.split('&')[0];
    }
    
    // If we found a video ID, create embed URL
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Return original if we couldn't parse it
    return url;
}

/**
 * Converts a standard Bandcamp URL to an embed URL
 * Attempts to extract the album/track ID from the page HTML
 * Falls back to returning original URL if conversion fails
 */
export async function convertToBandcampEmbed(url: string): Promise<string> {
    if (!url) return url;
    
    url = url.trim();
    
    // Already an embed URL
    if (url.includes('EmbeddedPlayer')) {
        return url;
    }
    
    try {
        const urlObj = new URL(url);
        
        // Check if it's a valid Bandcamp URL
        if (!urlObj.hostname.includes('bandcamp.com')) {
            return url;
        }
        
        // Determine if it's an album or track
        let type: 'album' | 'track' | null = null;
        if (urlObj.pathname.includes('/album/')) {
            type = 'album';
        } else if (urlObj.pathname.includes('/track/')) {
            type = 'track';
        } else {
            return url; // Not an album or track URL
        }
        
        // Try to fetch the page and extract the ID
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            // Method 1: Look for album/track ID in meta tags
            const metaMatch = html.match(/property="og:video"[^>]+content="[^"]*\/(album|track)=(\d+)/);
            if (metaMatch) {
                const id = metaMatch[2];
                return `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/`;
            }
            
            // Method 2: Look for tralbum data in JavaScript
            const tralbumMatch = html.match(/data-tralbum="(\d+)"/);
            if (tralbumMatch) {
                const id = tralbumMatch[1];
                return `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/`;
            }
            
            // Method 3: Look for embed code in the page
            const embedMatch = html.match(/EmbeddedPlayer\/(album|track)=(\d+)/);
            if (embedMatch) {
                const id = embedMatch[2];
                return `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/`;
            }
            
        } catch (fetchError) {
            // CORS error or network issue - fall back to original URL
            console.warn('Failed to fetch Bandcamp page:', fetchError);
            return url;
        }
        
    } catch (e) {
        // Invalid URL
        return url;
    }
    
    // If all methods failed, return original URL
    return url;
}
