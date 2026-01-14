const API_URL = import.meta.env.VITE_API_URL;

export async function searchComics(query: string)
{
    const response = await fetch(`${API_URL}/api/comics?search=${query}`);
    if (!response.ok) {
        // Read the error message from the response body
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
    }
    return response.json();
}