# LeetCode Problem Finder Chrome Extension

A Chrome extension that helps you quickly find and access LeetCode problems by their titles. Designed with enhanced integration for TakeUForward's DSA problem pages.

## 🚀 Features

- **Instant Problem Search**: Search for LeetCode problems by title with high accuracy matching
- **TakeUForward Integration**: Seamless integration with TakeUForward problem pages
- **Smart Detection**: Automatically detects problem titles on supported websites
- **Context Menu**: Right-click on selected text to search for LeetCode problems
- **Statistics Dashboard**: View LeetCode database statistics (total, free, premium problems)
- **Page Refresh Helper**: Automatic refresh suggestions when problem detection fails
- **Multiple Matching Strategies**: Exact, starts-with, and contains matching for better results

## 📋 How It Works

### 1. **On TakeUForward Pages**
- Visit any problem page on [TakeUForward DSA Problems](https://takeuforward.org/plus/dsa/problems-set)
- A blue search button appears next to the problem title
- Click the button to instantly find the corresponding LeetCode problem
- If no problem is detected, a refresh button appears to reload the page

### 2. **Extension Popup**
- Click the extension icon in your browser toolbar
- Enter a LeetCode problem title manually
- View search results with problem details and direct links
- Access LeetCode database statistics

### 3. **Context Menu**
- Select any text on any webpage
- Right-click and choose "Search [selected text] on LeetCode"
- The extension popup opens with the selected text pre-filled

### 4. **Other Websites**
- The extension automatically highlights detected LeetCode problem titles
- Click highlighted text to search for the problem

## 🛠 Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. **Download the Extension**
   - Clone or download this repository to your computer
   - Extract the files if downloaded as ZIP

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in the Chrome toolbar
   - Find "LeetCode Problem Finder" and click the pin icon
   - The extension icon will now be visible in your toolbar

### Method 2: Chrome Web Store (Future)
*This extension will be available on the Chrome Web Store soon.*

## 🎯 Usage Guide

### Basic Search
1. Click the extension icon
2. Type a LeetCode problem title (e.g., "Two Sum", "Valid Parentheses")
3. Click "Search" or press Enter
4. View results and click "Open" to go to LeetCode

### TakeUForward Integration
1. Visit [TakeUForward DSA Problems](https://takeuforward.org/plus/dsa/problems-set)
2. Navigate to any problem page
3. Look for the blue search button next to the problem title
4. Click to instantly find the LeetCode equivalent

### Context Menu Search
1. Select any text on a webpage that might be a LeetCode problem title
2. Right-click the selected text
3. Choose "Search '[selected text]' on LeetCode"
4. The extension popup opens with results

### Troubleshooting
- **Problem not detected**: Use the refresh button to reload the page
- **No results found**: Try variations of the problem title
- **Button not appearing**: Ensure you're on a TakeUForward problem page and the page has fully loaded

## 🔧 Technical Details

### Files Structure
```
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls and context menus
├── content.js            # Content script for TakeUForward integration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality and UI logic
└── README.md             # This file
```

### Permissions Used
- `activeTab`: Access current tab for title detection
- `storage`: Store temporary search data
- `contextMenus`: Add right-click search option
- `tabs`: Refresh pages when needed
- `host_permissions`: Access LeetCode and TakeUForward domains

### API Integration
- Uses LeetCode API (`leetcode-api-pied.vercel.app`) for problem data
- Implements smart matching algorithms for accurate results
- Handles rate limiting and error cases gracefully

### Matching Strategies
1. **Exact Match**: Direct title comparison (highest priority)
2. **Starts With**: Problem title starts with search term (4+ characters)
3. **Contains**: Search term contained in title (10+ characters, very strict)

## 🎨 Features in Detail

### Smart Problem Detection
- Automatically detects LeetCode problem patterns on web pages
- Supports multiple title formats (numbered, "Problem:", etc.)
- Filters out false positives with length and pattern validation

### Enhanced TakeUForward Experience
- Seamless integration with TakeUForward's problem page layout
- Automatic button placement next to problem titles
- Visual feedback with loading states and error handling
- Refresh functionality when detection fails

### User-Friendly Interface
- Clean, modern dark theme design
- Responsive button interactions with hover effects
- Clear error messages and helpful guidance
- Statistics dashboard for LeetCode database insights

### Error Handling
- Graceful handling of network failures
- Clear feedback when problems aren't found
- Automatic retry suggestions with refresh functionality
- Fallback detection methods for different page layouts

## 🔄 Updates and Maintenance

The extension automatically handles:
- API endpoint changes
- Website layout updates
- Performance optimizations
- Bug fixes and improvements

## 🤝 Contributing

Feel free to contribute to this project by:
- Reporting bugs or issues
- Suggesting new features
- Improving the code
- Adding support for more websites

## 📝 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check that you're using the latest version
2. Ensure you have proper internet connectivity
3. Try refreshing the page if problem detection fails
4. Verify you're on a supported website (TakeUForward)

For additional support, please create an issue in the project repository.

---

**Happy Coding! 🚀**

*This extension is designed to enhance your competitive programming journey by making LeetCode problem discovery faster and more efficient.*