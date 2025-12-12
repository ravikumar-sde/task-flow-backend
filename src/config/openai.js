require('dotenv').config();
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI configuration
const openaiConfig = {
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
};

module.exports = {
  openai,
  openaiConfig,
};

