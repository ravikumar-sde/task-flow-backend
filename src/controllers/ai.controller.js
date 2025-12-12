const openaiService = require('../services/openai.service');

/**
 * AI Controller
 * Handles AI-powered features like prompt parsing
 */
class AIController {
  /**
   * Parse user prompt and generate structured JSON
   * POST /api/v1/ai/parse-prompt
   */
  async parsePrompt(req, res) {
    try {
      const { prompt } = req.body;

      // Validate input
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Prompt is required and must be a non-empty string',
        });
      }

      // Check if prompt is too long (max 1000 characters)
      if (prompt.length > 1000) {
        return res.status(400).json({
          status: 'error',
          message: 'Prompt is too long. Maximum 1000 characters allowed',
        });
      }

      // Parse the prompt using OpenAI
      const result = await openaiService.parsePromptToJSON(prompt);

      res.status(200).json({
        status: 'success',
        message: 'Prompt parsed successfully',
        data: result.data,
        usage: result.usage,
      });
    } catch (error) {
      console.error('AI Controller Error:', error);
      
      // Handle specific errors
      if (error.message.includes('API key')) {
        return res.status(500).json({
          status: 'error',
          message: 'OpenAI API is not configured properly. Please contact administrator.',
        });
      }

      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to parse prompt',
      });
    }
  }

  /**
   * Health check for AI service
   * GET /api/v1/ai/health
   */
  async healthCheck(req, res) {
    try {
      // Check if OpenAI API key is configured
      const isConfigured = !!process.env.OPENAI_API_KEY;

      res.status(200).json({
        status: 'success',
        message: 'AI service is running',
        data: {
          configured: isConfigured,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

module.exports = new AIController();

