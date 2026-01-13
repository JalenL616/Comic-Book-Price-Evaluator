import './SearchBar.css'
import { searchComics } from '../services/api';

export function SearchBar() {
    async function search(formData: FormData) {
        const query = formData.get("query") as string;

        try {
          const comics = await searchComics(query);
          console.log('Results: ', comics);
        } catch (error)
        {
          console.error('Search failed: ', error)
        }
    }
    return (
        <form action={search} className="search-form">
          <label htmlFor="query" className="visually-hidden">
            Search comics:
          </label>
          <input 
            id="query" 
            type="text" 
            name="query" 
            placeholder="Enter comic UPC"
          />
          <button type="submit">Search</button>
        </form>
    );
}