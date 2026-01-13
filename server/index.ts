import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Test route
app.get('/', (req, res) => {
  res.send('Hello World!')
})

// Comic search route
app.get('/api/comics', (req, res) => {
  const query = req.query.search;
  console.log(`Searching for: ${query}`);

  res.json([{ id: 1, title: 'Spider-Man #1', upc: query, price: 100 }])
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})