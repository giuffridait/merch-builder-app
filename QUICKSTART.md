# Quick Start Guide

## Local Development

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Development Server
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Step 3: Try It Out!

Example conversation:
1. Type: "I want a hoodie for my running team, something bold"
2. Type: "Never Stop Running"
3. Type: "lightning bolt"
4. Pick a variant, adjust colors, add to cart!

## Deploy to Vercel

### Method 1: Vercel CLI (Fastest)
```bash
npm install -g vercel
vercel
```

Follow the prompts. Your app will be live in ~60 seconds.

### Method 2: GitHub + Vercel Dashboard
```bash
# Initialize git if needed
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/merch-builder.git
git push -u origin main
```

Then:
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Click "Deploy"

Vercel auto-detects Next.js config. No additional setup needed!

## Troubleshooting

### Port 3000 already in use?
```bash
npm run dev -- -p 3001
```

### Module not found errors?
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build errors on Vercel?
- Check that all TypeScript files have no errors
- Ensure Next.js version matches local (package.json)
- Check Vercel build logs for specific errors

## Features to Test

1. **Conversational Flow**: Try different ways of describing what you want
2. **Quick Suggestions**: Click the suggested phrases
3. **Design Variants**: See how AI scores different styles
4. **Color Contrast**: Pick dark/light colors - design auto-adjusts
5. **Cart Persistence**: Add items, refresh page - cart persists
6. **Mobile View**: Resize browser or use mobile device

## Customization Ideas

- Edit `lib/catalog.ts` to add products
- Edit `lib/icons.ts` to add icons
- Edit `lib/agent.ts` to change AI personality
- Edit `app/globals.css` to change theme colors
