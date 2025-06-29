# Confidence Picks Frontend

This project is a web application built with Svelte that allows users to log in and join groups to make picks in NFL games, competing against friends.

## Project Structure

The project has the following structure:

```
confidence-picks-frontend
├── src
│   ├── App.svelte          # Main Svelte component of the application
│   ├── main.js             # Entry point of the application
│   └── components
│       └── Header.svelte   # Header component for the application
├── public
│   ├── index.html          # Main HTML file serving the application
│   └── global.css          # Global styles for the application
├── package.json            # Configuration file for npm
├── vite.config.js          # Configuration for Vite build tool
└── README.md               # Documentation for the project
```

## Getting Started

To get started with the project, follow these steps:

1. **Clone the repository:**
   ```
   git clone https://github.com/yourusername/confidence-picks-frontend.git
   cd confidence-picks-frontend
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the development server:**
   ```
   npm run dev
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## Building for Production

To build the application for production, run:

```
npm run build
```

The built files will be generated in the `dist` directory.

## License

This project is licensed under the MIT License.