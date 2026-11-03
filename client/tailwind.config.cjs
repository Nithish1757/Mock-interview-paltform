const path = require('path');
module.exports = { content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')], theme: { extend: { colors: { ink: '#070B12', surface: '#0D131D', card: '#111B28', border: '#202D3B', cyan: '#55D6E8', text: '#F2F5F8', muted: '#8B98A8' } } }, plugins: [] };
