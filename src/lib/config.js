import { config } from 'dotenv';
config();

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const PORT = process.env.PORT || 8080;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;

export const AWS_REGION = process.env.AWS_REGION;
export const S3_VECTOR_BUCKET = process.env.S3_VECTOR_BUCKET;
export const S3_VECTOR_INDEX = process.env.S3_VECTOR_INDEX;

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;

export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;