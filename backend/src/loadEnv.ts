/**
 * Must be the very first import in server.ts.
 * Uses override:true so .env values always win over shell environment variables
 * (e.g. an empty ANTHROPIC_API_KEY exported in ~/.zshrc won't block the real key).
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
