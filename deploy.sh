#!/bin/bash

# Tradle Trading Journal Deployment Script
# Builds and optimizes the application for production deployment

set -e

echo "🚀 Starting Tradle Trading Journal deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ to continue."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm to continue."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Clean previous build
print_status "Cleaning previous build..."
rm -rf dist/
rm -rf node_modules/
rm -f package-lock.json

# Install dependencies
print_status "Installing dependencies..."
npm install --production=false

# Create dist directory
print_status "Creating distribution directory..."
mkdir -p dist/{css,js,data,assets}

# Copy all files to dist (excluding dev files)
print_status "Copying source files..."
rsync -av --exclude='.git' \
          --exclude='node_modules' \
          --exclude='.github' \
          --exclude='dist' \
          --exclude='deploy.sh' \
          --exclude='README.md' \
          --exclude='test.html' \
          ./ ./dist/

# Optimize HTML
print_status "Optimizing HTML files..."
if [ -f dist/index.html ]; then
    npx html-minifier-terser \
        --collapse-whitespace \
        --remove-comments \
        --remove-optional-tags \
        --remove-redundant-attributes \
        --remove-script-type-attributes \
        --remove-tag-whitespace \
        --use-short-doctype \
        --minify-css true \
        --minify-js true \
        dist/index.html \
        -o dist/index.html.tmp
    mv dist/index.html.tmp dist/index.html
    print_success "HTML optimization complete"
else
    print_warning "index.html not found for optimization"
fi

# Optimize CSS
print_status "Optimizing CSS files..."
if [ -f dist/css/style.css ]; then
    npx uglifycss dist/css/style.css > dist/css/style.min.css
    mv dist/css/style.min.css dist/css/style.css
    print_success "style.css optimization complete"
fi

if [ -f dist/css/responsive.css ]; then
    npx uglifycss dist/css/responsive.css > dist/css/responsive.min.css
    mv dist/css/responsive.min.css dist/css/responsive.css
    print_success "responsive.css optimization complete"
fi

# Optimize JavaScript
print_status "Optimizing JavaScript files..."
js_files=("main.js" "ui.js" "csvParser.js" "tradeCalculator.js")

for js_file in "${js_files[@]}"; do
    if [ -f "dist/js/${js_file}" ]; then
        npx terser "dist/js/${js_file}" --compress --mangle --output "dist/js/${js_file}.tmp"
        mv "dist/js/${js_file}.tmp" "dist/js/${js_file}"
        print_success "${js_file} optimization complete"
    else
        print_warning "${js_file} not found for optimization"
    fi
done

# Generate robots.txt
print_status "Generating robots.txt..."
cat > dist/robots.txt << EOF
User-agent: *
Allow: /

Sitemap: https://username.github.io/tradle-webapp/sitemap.xml
EOF

# Generate sitemap.xml
print_status "Generating sitemap.xml..."
current_date=$(date -u +%Y-%m-%d)
cat > dist/sitemap.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://username.github.io/tradle-webapp/</loc>
    <lastmod>${current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://username.github.io/tradle-webapp/#dashboard</loc>
    <lastmod>${current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://username.github.io/tradle-webapp/#import</loc>
    <lastmod>${current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://username.github.io/tradle-webapp/#export</loc>
    <lastmod>${current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
EOF

# Calculate build size
print_status "Calculating build size..."
original_size=$(du -sh . --exclude=dist --exclude=node_modules --exclude=.git 2>/dev/null | cut -f1)
dist_size=$(du -sh dist/ 2>/dev/null | cut -f1)

print_success "🎯 Build completed successfully!"
echo ""
echo "📊 Build Statistics:"
echo "  • Original size: ${original_size}"
echo "  • Optimized size: ${dist_size}"
echo "  • Build location: ./dist/"
echo ""
echo "📋 Next Steps:"
echo "  1. Test the build: npm run serve (from dist directory)"
echo "  2. Deploy to GitHub Pages: git add . && git commit -m 'Deploy' && git push"
echo "  3. Or use GitHub Actions for automatic deployment"
echo ""
print_success "🚀 Ready for deployment!"