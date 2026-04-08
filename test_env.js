import dotenv from 'dotenv';
import path from 'path';

const envPath = 'c:/Users/Nadeen/Documents/ShoeGo_Ecom_Website/.env.global';
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading env:', result.error);
} else {
  console.log('CLOUDINARY_CLOUD_NAME:', `[${process.env.CLOUDINARY_CLOUD_NAME}]`);
  console.log('CLOUDINARY_API_KEY:', `[${process.env.CLOUDINARY_API_KEY}]`);
  console.log('CLOUDINARY_API_SECRET:', `[${process.env.CLOUDINARY_API_SECRET}]`);
}
