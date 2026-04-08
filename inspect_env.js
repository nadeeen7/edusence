import fs from 'fs';

const envPath = 'c:/Users/Nadeen/Documents/ShoeGo_Ecom_Website/.env.global';
try {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('CLOUDINARY_CLOUD_NAME')) {
      console.log(`Line ${index + 1}: [${line}]`);
      const parts = line.split('=');
      if (parts.length > 1) {
        const value = parts[1].trim();
        console.log(`Value (trimmed): [${value}]`);
        console.log(`First char: [${value[0]}] (code: ${value.charCodeAt(0)})`);
        console.log(`Last char: [${value[value.length - 1]}] (code: ${value.charCodeAt(value.length - 1)})`);
      }
    }
  });
} catch (err) {
  console.error('Error reading file:', err);
}
