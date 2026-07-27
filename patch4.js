const fs = require('fs');
let content = fs.readFileSync('components/ProfileScannerDialog.tsx', 'utf-8');
content = content.replace('data: any;', 'data: unknown;');
fs.writeFileSync('components/ProfileScannerDialog.tsx', content);
