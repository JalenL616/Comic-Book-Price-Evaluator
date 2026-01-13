const API_URL = import.meta.env.VITE_API_URL;

export async function searchComics(query: string)
{
    const response = await fetch(`${API_URL}/api/comics?search=${query}`);
    if (!response.ok) {
        throw new Error('Search failed');
    }
    return response.json();
}