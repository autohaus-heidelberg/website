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
 * Extracts the Bandcamp EmbeddedPlayer URL from embed HTML or returns the URL if already valid
 * Accepts:
 * - Direct EmbeddedPlayer URLs
 * - Iframe embed code from Bandcamp's share dialog
 */
export function extractBandcampEmbedUrl(input: string): string | null {
    if (!input) return null;

    input = input.trim();

    // Already a direct EmbeddedPlayer URL
    if (input.startsWith('https://bandcamp.com/EmbeddedPlayer/')) {
        return input;
    }

    // Try to extract src from iframe embed code
    const srcMatch = input.match(/src=["'](https:\/\/bandcamp\.com\/EmbeddedPlayer\/[^"']+)["']/);
    if (srcMatch) {
        return srcMatch[1];
    }

    return null;
}
