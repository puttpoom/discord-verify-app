// Simple script to start the server and provide testing instructions
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Discord Verification Server...');
console.log('📋 Testing Instructions:');
console.log('');
console.log('1. Wait for server to start (you should see "Server is running on http://localhost:3000")');
console.log('2. Open a new terminal and run: node test-oauth.js url');
console.log('3. Copy the generated URL and open it in an INCOGNITO/PRIVATE browser window');
console.log('4. Complete the Discord authorization');
console.log('5. You should be redirected to the verification page with debug information');
console.log('');
console.log('🔧 If you get the invalid_grant error:');
console.log('   - Make sure you\'re using an incognito/private browser window');
console.log('   - Complete the process quickly (within 10 minutes)');
console.log('   - Don\'t refresh the page after getting the authorization code');
console.log('');
console.log('📖 For more help, see TROUBLESHOOTING.md');
console.log('');

// Start the server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`\n🛑 Server stopped with code ${code}`);
}); 